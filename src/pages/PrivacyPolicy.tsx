const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <article className="container max-w-3xl mx-auto prose prose-slate dark:prose-invert">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: April 28, 2026</p>

        <p className="text-foreground mb-6">
          Explorer by SL ("we," "us," or "our") operates the ExplorerBySL platform at{" "}
          <a href="https://app.explorerbysl.com" className="text-primary underline">
            app.explorerbysl.com
          </a>
          , a business management tool used internally by Explorer by SL to manage customer
          communications via Facebook Messenger.
        </p>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-foreground">1. Information We Collect</h2>
          <p className="text-foreground mb-2">
            When customers message the{" "}
            <a
              href="https://www.facebook.com/explorerbysl"
              className="text-primary underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Explorer by SL Facebook Page
            </a>{" "}
            via Messenger, we receive the following data through the Facebook Messenger API:
          </p>
          <ul className="list-disc pl-6 text-foreground space-y-1">
            <li><strong>Name</strong> – the customer's Facebook display name</li>
            <li><strong>Profile Picture</strong> – the customer's Facebook profile photo</li>
            <li><strong>Messages</strong> – the content of conversations initiated by customers through Messenger</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-foreground">2. How We Use This Data</h2>
          <p className="text-foreground mb-2">This data is used solely to:</p>
          <ul className="list-disc pl-6 text-foreground space-y-1">
            <li>Display and manage incoming customer inquiries within the ExplorerBySL platform</li>
            <li>Allow Explorer by SL staff to respond to customer messages</li>
            <li>Organize and track travel-related conversations</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-foreground">3. Data Sharing</h2>
          <p className="text-foreground">
            We do not sell or share customer data with third parties. Data is accessible only to
            authorized Explorer by SL staff using the platform.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-foreground">4. Facebook Platform Data</h2>
          <p className="text-foreground">
            All customer data is received through the Facebook Messenger API under Meta's Platform
            Terms. We access only the data necessary to operate the customer messaging workflow.
            This data is not used for advertising or resold in any form.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-foreground">5. Data Security</h2>
          <p className="text-foreground">
            We implement administrative and technical safeguards to protect your data from
            unauthorized access, disclosure, or loss, in accordance with industry standards.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-foreground">6. Data Retention & Deletion</h2>
          <p className="text-foreground">
            Customer message data is retained only as long as necessary to manage active inquiries.
            To request deletion of your data, contact us at{" "}
            <a href="mailto:stevenly@explorerbysl.com" className="text-primary underline">
              stevenly@explorerbysl.com
            </a>
            . We will promptly fulfill deletion requests in accordance with applicable law.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-foreground">7. Contact Us</h2>
          <p className="text-foreground">
            For questions or data deletion requests:
            <br />
            Email:{" "}
            <a href="mailto:stevenly@explorerbysl.com" className="text-primary underline">
              stevenly@explorerbysl.com
            </a>
            <br />
            Website:{" "}
            <a href="https://app.explorerbysl.com" className="text-primary underline">
              app.explorerbysl.com
            </a>
            <br />
            Facebook:{" "}
            <a
              href="https://facebook.com/explorerbysl"
              className="text-primary underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              facebook.com/explorerbysl
            </a>
          </p>
        </section>
      </article>
    </div>
  );
};

export default PrivacyPolicy;
