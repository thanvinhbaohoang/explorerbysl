const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Welcome to Client Info Harvest
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Track and manage your Telegram leads
        </p>
        <a
          href="/dashboard"
          className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          View Dashboard
        </a>
      </div>
    </div>
  );
};

export default Index;
