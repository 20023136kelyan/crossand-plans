
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, CreditCard, Gift, History, Plus, Minus, Star } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface WalletData {
  balance: number;
  credits: number;
  rewardPoints: number;
  transactions: Transaction[];
  rewards: Reward[];
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit' | 'reward';
  amount: number;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

interface Reward {
  id: string;
  title: string;
  description: string;
  cost: number;
  category: string;
  available: boolean;
  imageUrl?: string;
}

export default function WalletPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchWalletData();
  }, [user, router]);

  const fetchWalletData = async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/wallet/data', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch wallet data');
      }

      const data = await response.json();
      setWalletData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const redeemReward = async (rewardId: string, cost: number) => {
    if (!user || !walletData) return;

    if (walletData.rewardPoints < cost) {
      toast({
        title: 'Insufficient Points',
        description: 'You do not have enough reward points for this item.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/wallet/redeem', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rewardId })
      });

      if (!response.ok) {
        throw new Error('Failed to redeem reward');
      }

      toast({
        title: 'Reward Redeemed!',
        description: 'Your reward has been successfully redeemed.'
      });

      // Refresh wallet data
      fetchWalletData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to redeem reward. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'credit': return <Plus className="h-4 w-4 text-green-600" />;
      case 'debit': return <Minus className="h-4 w-4 text-red-600" />;
      case 'reward': return <Star className="h-4 w-4 text-yellow-600" />;
      default: return <History className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Error</h2>
          <p className="mt-2">{error}</p>
          <Button onClick={fetchWalletData} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-8 w-8" />
            Macaroom Wallet
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your credits, rewards, and transactions
          </p>
        </div>

        {/* Wallet Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Balance</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatCurrency(walletData?.balance || 0)}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Available balance
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Credits</CardTitle>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">
                  {walletData?.credits || 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Plan creation credits
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Reward Points</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">
                  {walletData?.rewardPoints || 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Redeemable points
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Transactions and Rewards */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="transactions">Transaction History</TabsTrigger>
            <TabsTrigger value="rewards">Rewards Store</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>
                  Your recent wallet activity and transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-6 w-16" />
                      </div>
                    ))}
                  </div>
                ) : walletData?.transactions && walletData.transactions.length > 0 ? (
                  <div className="space-y-4">
                    {walletData.transactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getTransactionIcon(transaction.type)}
                          <div>
                            <p className="font-medium">{transaction.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(transaction.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${
                            transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'credit' ? '+' : '-'}
                            {transaction.type === 'reward' ? `${transaction.amount} pts` : formatCurrency(transaction.amount)}
                          </p>
                          <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}>
                            {transaction.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No transactions yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rewards" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Rewards Store</CardTitle>
                <CardDescription>
                  Redeem your points for exclusive rewards and benefits
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="border rounded-lg p-4">
                        <Skeleton className="h-32 w-full mb-4" />
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/2 mb-4" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ))}
                  </div>
                ) : walletData?.rewards && walletData.rewards.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {walletData.rewards.map((reward) => (
                      <div key={reward.id} className="border rounded-lg p-4">
                        {reward.imageUrl && (
                          <img 
                            src={reward.imageUrl} 
                            alt={reward.title}
                            className="w-full h-32 object-cover rounded-md mb-4"
                          />
                        )}
                        <h3 className="font-semibold mb-2">{reward.title}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {reward.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{reward.cost} points</span>
                          <Button 
                            size="sm"
                            disabled={!reward.available || (walletData?.rewardPoints || 0) < reward.cost}
                            onClick={() => redeemReward(reward.id, reward.cost)}
                          >
                            {reward.available ? 'Redeem' : 'Unavailable'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No rewards available at the moment</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
