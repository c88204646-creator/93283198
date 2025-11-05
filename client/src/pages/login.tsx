
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Truck } from "lucide-react";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(username, password);
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* SVG Background Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="logistics-pattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
              {/* Truck Icon */}
              <g transform="translate(20, 20)">
                <path d="M1 3h14v10H1V3zm14 4h3l3 4v3h-3.17c-.41 1.16-1.52 2-2.83 2-1.31 0-2.42-.84-2.83-2H8.83c-.41 1.16-1.52 2-2.83 2s-2.42-.84-2.83-2H1v-2h3V3zm-9 12c.83 0 1.5-.67 1.5-1.5S6.83 16 6 16s-1.5.67-1.5 1.5S5.17 19 6 19zm9 0c.83 0 1.5-.67 1.5-1.5S15.83 16 15 16s-1.5.67-1.5 1.5.67 1.5 1.5 1.5z" fill="currentColor"/>
              </g>
              
              {/* Package Icon */}
              <g transform="translate(120, 20)">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="22.08" x2="12" y2="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </g>
              
              {/* Location Pin Icon */}
              <g transform="translate(20, 120)">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </g>
              
              {/* Clock Icon */}
              <g transform="translate(120, 120)">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="12 6 12 12 16 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#logistics-pattern)" />
        </svg>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-sm sm:max-w-md shadow-lg border relative z-10">
        <CardHeader className="space-y-3 text-center pb-6 px-4 sm:px-6">
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-primary flex items-center justify-center mb-1 shadow-md">
            <Truck className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-xl sm:text-2xl font-bold mb-1 text-foreground">
              NNEXIO
            </CardTitle>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Logistics Control Panel
            </p>
          </div>
          <CardDescription className="text-sm">
            Sign in to access your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                data-testid="input-username"
                disabled={isLoading}
                className="h-10 sm:h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
                disabled={isLoading}
                className="h-10 sm:h-11"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-10 sm:h-11" 
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
