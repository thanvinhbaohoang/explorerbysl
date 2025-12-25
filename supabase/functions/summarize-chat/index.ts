import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatSummary {
  personalInfo: {
    fullName: string | null;
    nationality: string | null;
    passportPhotoDetected: boolean;
    contactDetails: string | null;
  };
  travelDetails: {
    destinations: string[];
    travelDates: string | null;
    numberOfTravelers: string | null;
    purposeOfTravel: string | null;
  };
  serviceRequirements: {
    visaType: string | null;
    servicesRequested: string[];
    specialRequirements: string[];
    budgetIndication: string | null;
  };
  conversationStatus: {
    keyQuestions: string[];
    unansweredQuestions: string[];
    actionItems: string[];
    sentiment: 'positive' | 'neutral' | 'concerned';
  };
  attachments: {
    photoCount: number;
    voiceMessageCount: number;
    videoCount: number;
  };
  summary: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customerId, linkedCustomerIds, forceRefresh = false } = await req.json();
    
    if (!customerId) {
      return new Response(
        JSON.stringify({ error: 'Customer ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all messages for the customer (and linked accounts)
    const customerIds = linkedCustomerIds?.length > 0 ? linkedCustomerIds : [customerId];
    
    // Get current message count
    const { count: currentMessageCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('customer_id', customerIds);

    // Check for cached summary if not forcing refresh
    if (!forceRefresh) {
      const { data: cachedSummary } = await supabase
        .from('customer_summaries')
        .select('*')
        .eq('customer_id', customerId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cachedSummary) {
        const cacheAge = Date.now() - new Date(cachedSummary.generated_at).getTime();
        const oneHour = 60 * 60 * 1000;
        
        // Return cached if less than 1 hour old AND message count hasn't changed
        if (cacheAge < oneHour && cachedSummary.message_count === currentMessageCount) {
          console.log('Returning cached summary');
          return new Response(
            JSON.stringify({ 
              summary: cachedSummary.summary_data,
              cached: true,
              generatedAt: cachedSummary.generated_at
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .in('customer_id', customerIds)
      .order('timestamp', { ascending: true })
      .limit(200); // Limit to last 200 messages for context

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch messages' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || messages.length === 0) {
      const emptySummary = {
        personalInfo: { fullName: null, nationality: null, passportPhotoDetected: false, contactDetails: null },
        travelDetails: { destinations: [], travelDates: null, numberOfTravelers: null, purposeOfTravel: null },
        serviceRequirements: { visaType: null, servicesRequested: [], specialRequirements: [], budgetIndication: null },
        conversationStatus: { keyQuestions: [], unansweredQuestions: [], actionItems: [], sentiment: 'neutral' },
        attachments: { photoCount: 0, voiceMessageCount: 0, videoCount: 0 },
        summary: 'No messages to summarize.'
      };
      return new Response(
        JSON.stringify({ summary: emptySummary, cached: false, generatedAt: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format messages for AI
    const formattedMessages = messages.map(msg => {
      const sender = msg.sender_type === 'customer' ? 'Customer' : `Employee (${msg.sent_by_name || 'Staff'})`;
      const timestamp = new Date(msg.timestamp).toLocaleString();
      let content = '';
      
      if (msg.message_type === 'text' && msg.message_text) {
        content = msg.message_text;
      } else if (msg.message_type === 'photo') {
        content = `[Photo sent]${msg.message_text && msg.message_text !== '[Photo]' ? ` Caption: ${msg.message_text}` : ''}`;
      } else if (msg.message_type === 'voice') {
        content = `[Voice message${msg.voice_duration ? ` - ${msg.voice_duration}s` : ''}]${msg.voice_transcription ? ` Transcription: "${msg.voice_transcription}"` : ''}`;
      } else if (msg.message_type === 'video') {
        content = `[Video sent${msg.video_duration ? ` - ${msg.video_duration}s` : ''}]`;
      } else if (msg.message_text) {
        content = msg.message_text;
      }
      
      return `[${timestamp}] ${sender}: ${content}`;
    }).join('\n');

    // Count attachments
    const photoCount = messages.filter(m => m.message_type === 'photo').length;
    const voiceCount = messages.filter(m => m.message_type === 'voice').length;
    const videoCount = messages.filter(m => m.message_type === 'video').length;

    const systemPrompt = `You are an AI assistant for a travel agency. Analyze the following customer chat conversation and extract key information.

Return a JSON object with the following structure (use null for missing info, empty arrays for no items):
{
  "personalInfo": {
    "fullName": "Customer's full name if mentioned",
    "nationality": "Customer's nationality/citizenship if mentioned",
    "passportPhotoDetected": true/false (if any photo seems to be a passport/ID document based on context),
    "contactDetails": "Any phone, email, or other contact info mentioned"
  },
  "travelDetails": {
    "destinations": ["Array of countries/cities mentioned as travel destinations"],
    "travelDates": "Travel dates or period if mentioned",
    "numberOfTravelers": "Number of people traveling if mentioned",
    "purposeOfTravel": "Purpose: tourism, business, study, medical, etc."
  },
  "serviceRequirements": {
    "visaType": "Type of visa needed if mentioned",
    "servicesRequested": ["List of services requested: visa, tickets, hotel, insurance, etc."],
    "specialRequirements": ["Any special requests or requirements"],
    "budgetIndication": "Any budget or price expectations mentioned"
  },
  "conversationStatus": {
    "keyQuestions": ["Important questions the customer has asked"],
    "unansweredQuestions": ["Questions that still need answers"],
    "actionItems": ["Things that need to be done/followed up on"],
    "sentiment": "positive/neutral/concerned - customer's overall mood"
  },
  "summary": "A brief 2-3 sentence summary of the conversation and current status"
}

Only respond with the JSON object, no additional text.`;

    const userPrompt = `Analyze this travel agency customer conversation:\n\n${formattedMessages}\n\nAttachments in conversation: ${photoCount} photos, ${voiceCount} voice messages, ${videoCount} videos.`;

    console.log('Calling Lovable AI for chat summarization...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response:', aiResponse);
      return new Response(
        JSON.stringify({ error: 'Invalid AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response from AI
    let summary: ChatSummary;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      summary = JSON.parse(cleanContent);
      
      // Add attachment counts from our actual data
      summary.attachments = {
        photoCount,
        voiceMessageCount: voiceCount,
        videoCount
      };
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError, content);
      // Return a fallback response
      summary = {
        personalInfo: { fullName: null, nationality: null, passportPhotoDetected: false, contactDetails: null },
        travelDetails: { destinations: [], travelDates: null, numberOfTravelers: null, purposeOfTravel: null },
        serviceRequirements: { visaType: null, servicesRequested: [], specialRequirements: [], budgetIndication: null },
        conversationStatus: { keyQuestions: [], unansweredQuestions: [], actionItems: [], sentiment: 'neutral' },
        attachments: { photoCount, voiceMessageCount: voiceCount, videoCount },
        summary: 'Unable to generate summary. Please try again.'
      };
    }

    // Save summary to database
    const generatedAt = new Date().toISOString();
    await supabase
      .from('customer_summaries')
      .upsert({
        customer_id: customerId,
        summary_data: summary,
        message_count: currentMessageCount || messages.length,
        generated_at: generatedAt
      }, {
        onConflict: 'customer_id'
      });

    console.log('Chat summary generated and saved successfully');

    return new Response(
      JSON.stringify({ summary, cached: false, generatedAt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in summarize-chat function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
