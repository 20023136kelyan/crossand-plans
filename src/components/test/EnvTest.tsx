'use client';

export function EnvTest() {
  return (
    <div className="fixed bottom-4 right-4 bg-background p-4 rounded-lg shadow-lg border z-50">
      <h3 className="font-bold mb-2">Environment Test</h3>
      <div className="text-xs font-mono p-2 bg-muted rounded">
        <p>NEXT_PUBLIC_GIPHY_API_KEY: {process.env.NEXT_PUBLIC_GIPHY_API_KEY ? '✅ Set' : '❌ Not set'}</p>
        <p className="text-muted-foreground text-xxs mt-1">
          {process.env.NEXT_PUBLIC_GIPHY_API_KEY 
            ? `Key: ${process.env.NEXT_PUBLIC_GIPHY_API_KEY.substring(0, 4)}...${process.env.NEXT_PUBLIC_GIPHY_API_KEY.substring(process.env.NEXT_PUBLIC_GIPHY_API_KEY.length - 4)}`
            : 'No key found'}
        </p>
      </div>
    </div>
  );
}
