'use client';

import { NewPlanForm } from '@/components/plans/NewPlanForm';
import { GoogleMapsProvider } from '@/context/GoogleMapsContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function CreatePlanPage() {
    const router = useRouter();

    return (
        <GoogleMapsProvider>
            <div className="flex flex-col h-screen bg-background text-foreground">
                {/* Header */}
                <header className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2 border-b border-border/20 bg-background/70 backdrop-blur-md z-20">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/plans')} aria-label="Go to My Plans" className="hover:bg-accent/50">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    
                    <div className="flex items-center">
                        <div
                            className={cn(
                                "px-4 py-2 text-sm font-medium transition-colors relative cursor-pointer",
                                "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => router.push('/plans/generate')}
                        >
                            <Sparkles className="w-4 h-4 mr-2 inline" />
                            AI Generated
                        </div>
                        <div
                            className={cn(
                                "px-4 py-2 text-sm font-medium transition-colors relative cursor-pointer",
                                "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-full"
                            )}
                        >
                            Manual
                        </div>
                    </div>
                    
                    <div className="w-10 h-10"></div>
                </header>
                
                {/* Main Content */}
                <div className="flex-1 overflow-hidden">
                    <NewPlanForm />
                </div>
            </div>
        </GoogleMapsProvider>
    );
}

