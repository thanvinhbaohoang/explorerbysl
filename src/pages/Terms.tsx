const Terms = () => {
  const sections = [
    { title: "1. Acceptance of Terms", body: 'By accessing or using ExplorerBySL ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.' },
    { title: "2. Description of Service", body: "ExplorerBySL is a customer relationship management platform that allows travel agency staff to manage customer inquiries received via Facebook Messenger and other channels." },
    { title: "3. Use of the Platform", body: "You agree to use the Platform only for lawful business purposes. You may not use the Platform to send unsolicited messages, harass users, or violate any applicable law or Meta Platform Policy." },
    { title: "4. Facebook Integration", body: "The Platform integrates with Meta's Messenger API to receive and respond to customer-initiated messages. Use of this integration is subject to Meta's Terms of Service and Platform Policies." },
    { title: "5. Data and Privacy", body: "We collect and process customer data solely to facilitate business communications. We do not sell customer data to third parties. For full details, refer to our Privacy Policy." },
    { title: "6. Account Responsibility", body: "You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account." },
    { title: "7. Termination", body: "We reserve the right to suspend or terminate access to the Platform at our discretion for violations of these Terms." },
    { title: "8. Limitation of Liability", body: 'ExplorerBySL is provided "as is." We are not liable for any indirect, incidental, or consequential damages arising from use of the Platform.' },
    { title: "9. Changes to Terms", body: "We may update these Terms at any time. Continued use of the Platform after changes constitutes acceptance." },
  ];

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <article className="container max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Terms of Service — ExplorerBySL</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: April 28, 2026</p>

        {sections.map((s) => (
          <section key={s.title} className="mb-6">
            <h2 className="text-xl font-semibold mb-2 text-foreground">{s.title}</h2>
            <p className="text-foreground">{s.body}</p>
          </section>
        ))}

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-foreground">10. Contact</h2>
          <p className="text-foreground">
            For questions about these Terms, contact us at:{" "}
            <a href="mailto:stevenly@explorerbysl.com" className="text-primary underline">
              stevenly@explorerbysl.com
            </a>
          </p>
        </section>
      </article>
    </div>
  );
};

export default Terms;
