import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MondayRequest {
  action: 'get_boards' | 'get_board_columns' | 'get_board_items';
  boardId?: string;
  cursor?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MONDAY_API_TOKEN = Deno.env.get('MONDAY_API_TOKEN');
    
    if (!MONDAY_API_TOKEN) {
      console.error('MONDAY_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Monday.com API token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, boardId, cursor } = await req.json() as MondayRequest;
    console.log(`Monday import action: ${action}, boardId: ${boardId}`);

    let query = '';
    let variables: Record<string, unknown> = {};

    switch (action) {
      case 'get_boards':
        query = `
          query {
            boards(limit: 50) {
              id
              name
              description
              items_count
            }
          }
        `;
        break;

      case 'get_board_columns':
        if (!boardId) {
          return new Response(
            JSON.stringify({ error: 'boardId is required for get_board_columns' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        query = `
          query ($boardId: [ID!]) {
            boards(ids: $boardId) {
              id
              name
              columns {
                id
                title
                type
                settings_str
              }
            }
          }
        `;
        variables = { boardId: [boardId] };
        break;

      case 'get_board_items':
        if (!boardId) {
          return new Response(
            JSON.stringify({ error: 'boardId is required for get_board_items' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        query = `
          query ($boardId: [ID!], $cursor: String) {
            boards(ids: $boardId) {
              id
              name
              items_page(limit: 100, cursor: $cursor) {
                cursor
                items {
                  id
                  name
                  created_at
                  updated_at
                  column_values {
                    id
                    text
                    value
                    type
                  }
                }
              }
            }
          }
        `;
        variables = { boardId: [boardId], cursor: cursor || null };
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log('Sending GraphQL query to Monday.com API');
    
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MONDAY_API_TOKEN,
        'API-Version': '2024-01'
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Monday.com API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Monday.com API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('Monday.com GraphQL errors:', JSON.stringify(data.errors));
      return new Response(
        JSON.stringify({ error: 'Monday.com API returned errors', details: data.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Monday.com API response successful for action: ${action}`);
    
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in monday-import function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
