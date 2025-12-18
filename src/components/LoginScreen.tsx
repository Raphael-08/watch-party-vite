

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup } from '@/components/ui/field';
import { Tv, Mail, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { appwrite } from '@/lib/appwrite';

interface LoginScreenProps {
  onLogin: (username: string, appwriteUser?: any) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    // Always apply dark mode
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      setIsAuthenticating(true);

      const user = await appwrite.loginWithEmail(email, password);

      // Get username from user data
      const username = user.name || email.split('@')[0];

      localStorage.setItem('watchPartyUsername', username);
      localStorage.setItem('appwriteUser', JSON.stringify(user));

      toast.success(`Welcome back, ${username}!`);
      onLogin(username, user);
    } catch (error: any) {
      console.error('Login failed:', error);
      toast.error(error.message || 'Failed to login');
      setIsAuthenticating(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !name) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      setIsAuthenticating(true);

      const user = await appwrite.createAccount(email, password, name);

      localStorage.setItem('watchPartyUsername', name);
      localStorage.setItem('appwriteUser', JSON.stringify(user));

      toast.success(`Welcome, ${name}!`);
      onLogin(name, user);
    } catch (error: any) {
      console.error('Signup failed:', error);
      toast.error(error.message || 'Failed to create account');
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side - Hero section */}
      <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="max-w-xl">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/20 rounded-3xl mb-8">
            <Tv className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Watch Party
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Stream together in perfect sync. Watch Netflix, YouTube, and more with friends, no matter where they are.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-primary font-semibold">✓</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Synchronized Playback</h3>
                <p className="text-sm text-muted-foreground">Everyone watches at the same time, perfectly in sync</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-primary font-semibold">✓</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Real-time Chat</h3>
                <p className="text-sm text-muted-foreground">Chat with your friends while watching</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-primary font-semibold">✓</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Easy Room Sharing</h3>
                <p className="text-sm text-muted-foreground">Share a simple code to invite friends instantly</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
              <Tv className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Watch Party</h1>
            <p className="text-muted-foreground mt-2">Stream together in perfect sync</p>
          </div>

          <Card className="border-border/40 shadow-lg">
            <CardHeader className="space-y-2 pb-6">
              <CardTitle className="text-2xl">Welcome</CardTitle>
              <CardDescription>
                Sign in to start watching together
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                {/* Login Tab */}
                <TabsContent value="login">
                  <form onSubmit={handleEmailLogin}>
                    <FieldGroup>
                      <Field>
                        <Label htmlFor="login-email">Email</Label>
                        <Input
                          id="login-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="h-11"
                          required
                          disabled={isAuthenticating}
                        />
                      </Field>

                      <Field>
                        <Label htmlFor="login-password">Password</Label>
                        <Input
                          id="login-password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="h-11"
                          required
                          disabled={isAuthenticating}
                        />
                      </Field>

                      <Button
                        type="submit"
                        className="w-full h-11"
                        size="lg"
                        disabled={isAuthenticating}
                      >
                        {isAuthenticating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4 mr-2" />
                            Sign In
                          </>
                        )}
                      </Button>
                    </FieldGroup>
                  </form>
                </TabsContent>

                {/* Sign Up Tab */}
                <TabsContent value="signup">
                  <form onSubmit={handleEmailSignup}>
                    <FieldGroup>
                      <Field>
                        <Label htmlFor="signup-name">Name</Label>
                        <Input
                          id="signup-name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          className="h-11"
                          required
                          disabled={isAuthenticating}
                        />
                      </Field>

                      <Field>
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="h-11"
                          required
                          disabled={isAuthenticating}
                        />
                      </Field>

                      <Field>
                        <Label htmlFor="signup-password">Password</Label>
                        <Input
                          id="signup-password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 8 characters"
                          className="h-11"
                          required
                          disabled={isAuthenticating}
                          minLength={8}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Must be at least 8 characters
                        </p>
                      </Field>

                      <Button
                        type="submit"
                        className="w-full h-11"
                        size="lg"
                        disabled={isAuthenticating}
                      >
                        {isAuthenticating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4 mr-2" />
                            Create Account
                          </>
                        )}
                      </Button>
                    </FieldGroup>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            v1.5.3 • Watch Party
          </p>
        </div>
      </div>
    </div>
  );
}
