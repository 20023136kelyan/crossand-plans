import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FCMTokenRegistration } from '@/components/FCMTokenRegistration';
import { Button } from '@/components/ui/button';

export default function PushNotificationTestPage() {
  const { user } = useAuth();
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendTestNotification = async () => {
    if (!user) {
      setResult('You must be logged in.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/test-fcm', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        setResult('Push notification sent! Check your device.');
      } else {
        setResult('Failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      setResult('Error: ' + (err.message || err.toString()));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">Push Notification Test</h1>
      <FCMTokenRegistration />
      <Button onClick={sendTestNotification} disabled={loading || !user}>
        {loading ? 'Sending...' : 'Send Test Push Notification'}
      </Button>
      {result && <div className="mt-4 text-sm text-gray-700">{result}</div>}
      <div className="mt-6 text-xs text-gray-500">
        Make sure you have allowed notifications in your browser and registered your device.<br/>
        This will send a test notification to your current user account.
      </div>
    </div>
  );
} 