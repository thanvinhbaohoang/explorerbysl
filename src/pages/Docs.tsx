import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Send, Users, BarChart3, Link2, Globe } from "lucide-react";

const Docs = () => {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Documentation</h1>
        <p className="text-muted-foreground">
          Learn how the lead tracking, customer management, and messaging system works.
        </p>
      </div>

      <div className="space-y-6">
        {/* Section 1: Telegram Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Telegram Lead Tracking Setup
            </CardTitle>
            <CardDescription>
              Track leads from Facebook posts through Telegram with UTM parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="url-structure">
                <AccordionTrigger>URL Structure</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p>Use this URL format in your Facebook posts to track leads:</p>
                  <code className="block bg-muted p-3 rounded-md text-sm overflow-x-auto">
                    https://yourdomain.com/telegram?p=[tag]&utm_source=facebook&utm_campaign=[campaign_name]
                  </code>
                  <div className="mt-3">
                    <p className="font-medium mb-2">Parameters:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      <li><code className="text-foreground">p</code> - Post tag identifier (e.g., "korean-visa-2", "japan-trip")</li>
                      <li><code className="text-foreground">fbclid</code> - Auto-added by Facebook for click tracking</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="utm-tracking">
                <AccordionTrigger>UTM Parameters</AccordionTrigger>
                <AccordionContent>
                  <p className="mb-3">The system captures these UTM parameters for analytics:</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4">Parameter</th>
                          <th className="text-left py-2">Description</th>
                        </tr>
                      </thead>
                      <tbody className="text-muted-foreground">
                        <tr className="border-b">
                          <td className="py-2 pr-4"><code>utm_source</code></td>
                          <td>Traffic source (e.g., facebook, instagram)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 pr-4"><code>utm_medium</code></td>
                          <td>Marketing medium (e.g., social, cpc, email)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 pr-4"><code>utm_campaign</code></td>
                          <td>Campaign name</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 pr-4"><code>utm_content</code></td>
                          <td>Differentiates ads/links</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 pr-4"><code>utm_term</code></td>
                          <td>Paid search keywords</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 pr-4"><code>utm_campaign_id</code></td>
                          <td>Facebook campaign ID</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 pr-4"><code>utm_adset_id</code></td>
                          <td>Facebook ad set ID</td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4"><code>utm_ad_id</code></td>
                          <td>Facebook ad ID</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="flow">
                <AccordionTrigger>How It Works (Flow)</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <Badge variant="outline" className="shrink-0">1</Badge>
                      <p>Customer clicks link in Facebook post containing <code>/telegram?p=tag&fbclid=...</code></p>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="outline" className="shrink-0">2</Badge>
                      <p>System captures all URL parameters (fbclid, UTM tags, post tag)</p>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="outline" className="shrink-0">3</Badge>
                      <p>Creates a lead record in the database with these parameters</p>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="outline" className="shrink-0">4</Badge>
                      <p>Redirects customer to Telegram bot with the lead UUID</p>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="outline" className="shrink-0">5</Badge>
                      <p>Customer clicks "Start" → bot links their Telegram ID to the lead record</p>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="outline" className="shrink-0">6</Badge>
                      <p>Lead appears in <strong>/traffic</strong> with all tracking data</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Section 2: Telegram Bot */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Telegram Bot
            </CardTitle>
            <CardDescription>
              How the messaging bot works for customer communication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg border">
              <p className="font-medium mb-2">Bot Name: <code>ClientInfoHarvestBot</code></p>
              <p className="text-sm text-muted-foreground">
                The bot acts as an intermediary between customers and your team.
              </p>
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="how-it-works">
                <AccordionTrigger>How It Works</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <Badge className="shrink-0">Customer</Badge>
                      <p>Sends <code>/start</code> command to the bot</p>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="secondary" className="shrink-0">Bot</Badge>
                      <p>Captures: Telegram ID, username, first/last name, language code, premium status</p>
                    </div>
                    <div className="flex gap-3">
                      <Badge className="shrink-0">Customer</Badge>
                      <p>Sends messages to the bot normally</p>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="secondary" className="shrink-0">System</Badge>
                      <p>All messages are stored in the database</p>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="outline" className="shrink-0">Employee</Badge>
                      <p>Views messages in <strong>/customers</strong> chatbox and replies</p>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="secondary" className="shrink-0">Bot</Badge>
                      <p>Delivers employee's reply to the customer</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="data-collected">
                <AccordionTrigger>Data Collected</AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Telegram ID (unique identifier)</li>
                    <li>Username (@handle)</li>
                    <li>First name & Last name</li>
                    <li>Language code (e.g., en, th, ko)</li>
                    <li>Premium status (Telegram Premium subscriber)</li>
                    <li>All message content (text, photos, voice, video)</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Section 3: Messenger Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Messenger Client Info
            </CardTitle>
            <CardDescription>
              Automatic customer data collection from Facebook Messenger
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="auto-collection">
                <AccordionTrigger>Automatic Data Collection</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p>When a customer messages your Facebook page, the system automatically captures:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-2">
                    <li><strong>messenger_id</strong> - Unique Messenger identifier</li>
                    <li><strong>messenger_name</strong> - Customer's Facebook name</li>
                    <li><strong>profile_pic</strong> - Profile picture URL</li>
                    <li><strong>locale</strong> - Language/region (e.g., en_US, th_TH)</li>
                  </ul>
                  <p className="mt-3">A customer record is created automatically, and all messages are stored with <code>platform='messenger'</code>.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="ad-context">
                <AccordionTrigger>Ad Context Tracking</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p>When customers click a "Send Message" button on a Facebook ad, additional context is captured:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-2">
                    <li>Ad ID and Ad Name</li>
                    <li>Adset ID and Adset Name</li>
                    <li>Campaign ID and Campaign Name</li>
                    <li>Ref parameter (custom tracking tag)</li>
                  </ul>
                  <p className="mt-3 text-sm">This data links Messenger leads to your ad campaigns.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="messaging-window">
                <AccordionTrigger>24-Hour Messaging Window</AccordionTrigger>
                <AccordionContent>
                  <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
                    <p className="text-sm">
                      <strong>Important:</strong> Meta limits replies to 24 hours after the customer's last message. 
                      After this window closes, you cannot send messages until the customer messages again.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Separator />

        {/* Section 4: Pages Explained */}
        <h2 className="text-2xl font-bold mt-8">Pages Overview</h2>

        {/* Customers Page */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              /customers
            </CardTitle>
            <CardDescription>
              View and manage all customer conversations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="display">
                <AccordionTrigger>Customer Display</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p>The customers page shows all customers from both platforms:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-2">
                    <li>Customer name and profile picture</li>
                    <li>Platform badges showing <Badge variant="secondary" className="mx-1">Telegram</Badge> and/or <Badge variant="secondary" className="mx-1">Messenger</Badge></li>
                    <li>First message timestamp</li>
                    <li>Lead source information (campaign, post tag)</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="linking">
                <AccordionTrigger>Linking Customers</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p>When the same person uses both Telegram AND Messenger:</p>
                  <div className="space-y-2 mt-2">
                    <div className="flex gap-3">
                      <Badge variant="outline" className="shrink-0">1</Badge>
                      <p>Click the link icon on a customer row</p>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="outline" className="shrink-0">2</Badge>
                      <p>Search for the other account (by name or ID)</p>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="outline" className="shrink-0">3</Badge>
                      <p>Confirm the link</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Linked accounts show both platform badges and combine conversation history.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="chatbox">
                <AccordionTrigger>Using the Chatbox</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex gap-3">
                      <Badge variant="outline" className="shrink-0">1</Badge>
                      <p>Click on a customer row to select them</p>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="outline" className="shrink-0">2</Badge>
                      <p>View the conversation history on the right panel</p>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="outline" className="shrink-0">3</Badge>
                      <p>Type your reply in the input field</p>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="outline" className="shrink-0">4</Badge>
                      <p>Press Enter or click Send to deliver the message</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Messages are delivered through the Telegram bot or Facebook page depending on the customer's platform.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Traffic Page */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              /traffic
            </CardTitle>
            <CardDescription>
              View and analyze lead traffic data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="what-it-shows">
                <AccordionTrigger>What It Shows</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p>The traffic page displays all lead records with:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-2">
                    <li>Customer name (click to navigate to their profile)</li>
                    <li>Platform (Telegram or Messenger)</li>
                    <li>UTM source and campaign</li>
                    <li>Post tag (the <code>p</code> parameter)</li>
                    <li>Messenger ref (for Messenger ad clicks)</li>
                    <li>Lead creation date</li>
                    <li><Badge variant="outline">New</Badge> badge for first-time customers</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="filtering">
                <AccordionTrigger>Filtering Options</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p>Filter traffic data by:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-2">
                    <li><strong>Platform</strong> - Telegram or Messenger</li>
                    <li><strong>Source</strong> - UTM source values</li>
                    <li><strong>Campaign</strong> - UTM campaign names</li>
                    <li><strong>Post Tag</strong> - Custom post identifiers</li>
                    <li><strong>Date Range</strong> - Filter by creation date</li>
                    <li><strong>Search</strong> - Search by customer name</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="how-generated">
                <AccordionTrigger>How Traffic Is Generated</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p><strong>Telegram leads:</strong></p>
                  <p className="text-sm text-muted-foreground ml-4">
                    Created when users click the <code>/telegram?p=tag</code> link from your posts
                  </p>
                  
                  <p className="mt-3"><strong>Messenger leads:</strong></p>
                  <p className="text-sm text-muted-foreground ml-4">
                    Created when users message your page through an ad with the "Send Message" button, 
                    or through a Messenger ref link
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Quick Reference */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Quick Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="font-medium mb-2">Telegram Link Template:</p>
                <code className="block bg-background p-2 rounded text-xs">
                  /telegram?p=YOUR_TAG&utm_source=facebook&utm_campaign=YOUR_CAMPAIGN
                </code>
              </div>
              <div>
                <p className="font-medium mb-2">Data Flow:</p>
                <p className="text-sm text-muted-foreground">
                  Facebook Post → /telegram → Bot → /customers + /traffic
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Docs;
