

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Palette, Volume2, Bell, Info, Trash2, AlertTriangle, User, Monitor, Globe, Zap, Key, Lock } from 'lucide-react';
import { API_URL } from '@/lib/config';
import AvatarUpload from '@/components/AvatarUpload';
import { appwrite } from '@/lib/appwrite';

interface Settings {
  autoPlay: boolean;
  syncPlayback: boolean;
  notifyJoin: boolean;
  notifyLeave: boolean;
  notifyChat: boolean;
  volume: number;
}

interface HyperbeamSettings {
  kiosk: boolean;
  dark: boolean;
  webgl: boolean;
  adblock: boolean;
  draw: boolean;
  useTag: boolean;  // Session reuse via tag (premium feature)
  resolution: '720p' | '1080p';  // Video resolution (1080p is premium)
  fps: number;
  region: 'NA' | 'EU' | 'AS';
  quality: 'sharp' | 'smooth' | 'blocky';
}

export default function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>({
    autoPlay: true,
    syncPlayback: true,
    notifyJoin: true,
    notifyLeave: false,
    notifyChat: true,
    volume: 80,
  });

  const [hyperbeamSettings, setHyperbeamSettings] = useState<HyperbeamSettings>({
    kiosk: true,
    dark: true,
    webgl: true,
    adblock: true,
    draw: false,
    useTag: true,  // Enable session reuse by default
    resolution: '720p',  // Default to 720p (standard)
    fps: 30,
    region: 'AS',  // Default to Asia for Indian users
    quality: 'smooth',
  });

  const [useProductionKey, setUseProductionKey] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('watchPartySettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }

    const savedHyperbeam = localStorage.getItem('hyperbeamSettings');
    if (savedHyperbeam) {
      try {
        setHyperbeamSettings(JSON.parse(savedHyperbeam));
      } catch (e) {
        console.error('Failed to parse Hyperbeam settings:', e);
      }
    }

    // Load Hyperbeam API mode (test vs production)
    const savedApiMode = localStorage.getItem('hyperbeamApiMode');
    if (savedApiMode) {
      setUseProductionKey(savedApiMode === 'production');
    }

    // Load user data
    const appwriteUser = localStorage.getItem('appwriteUser');
    const username = localStorage.getItem('watchPartyUsername');
    if (appwriteUser) {
      try {
        const userData = JSON.parse(appwriteUser);
        setUser({ ...userData, username: username || userData.name });
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    } else if (username) {
      setUser({ username, name: username });
    }
  }, []);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('watchPartySettings', JSON.stringify(newSettings));

    toast.success('Settings saved');
  };

  const updateHyperbeamSetting = <K extends keyof HyperbeamSettings>(key: K, value: HyperbeamSettings[K]) => {
    const newSettings = { ...hyperbeamSettings, [key]: value };
    setHyperbeamSettings(newSettings);
    localStorage.setItem('hyperbeamSettings', JSON.stringify(newSettings));

    toast.success('Hyperbeam settings saved');
  };

  const toggleApiMode = (useProduction: boolean) => {
    setUseProductionKey(useProduction);
    localStorage.setItem('hyperbeamApiMode', useProduction ? 'production' : 'test');

    // If switching to test mode, disable restricted features
    if (!useProduction) {
      const updatedSettings = {
        ...hyperbeamSettings,
        kiosk: false,
        adblock: false,
        useTag: false,
        resolution: '720p' as const,  // Force 720p in test mode
        fps: hyperbeamSettings.fps === 60 ? 30 : hyperbeamSettings.fps,  // Reset 60 FPS to 30 in test mode
        // Keep region selection - testing if it's actually a premium feature
      };
      setHyperbeamSettings(updatedSettings);
      localStorage.setItem('hyperbeamSettings', JSON.stringify(updatedSettings));
      toast.info('Switched to TEST mode - Restricted features disabled');
    } else {
      toast.success('Switched to PRODUCTION mode - All features available');
    }
  };

  const handleAvatarUpload = (fileId: string, url: string) => {
    // Update user data with new avatar
    const updatedUser = { ...user, avatar: url, avatarFileId: fileId };
    setUser(updatedUser);

    // Save to localStorage
    localStorage.setItem('appwriteUser', JSON.stringify(updatedUser));

    toast.success('Avatar updated successfully!');
  };

  const handleAvatarRemove = async () => {
    if (user?.avatarFileId) {
      try {
        await appwrite.deleteAvatar(user.avatarFileId);
      } catch (error) {
        console.error('Failed to delete avatar file:', error);
      }
    }

    // Update user data
    const updatedUser = { ...user, avatar: null, avatarFileId: null };
    setUser(updatedUser);

    // Save to localStorage
    localStorage.setItem('appwriteUser', JSON.stringify(updatedUser));

    toast.success('Avatar removed');
  };

  const handleForceDeleteAllSessions = async () => {
    setIsDeleting(true);
    setDeleteResult(null);

    try {
      const response = await fetch(`${API_URL}/api/terminate-all-sessions`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to terminate sessions');
      }

      const data = await response.json();
      setDeleteResult(`✅ Successfully terminated ${data.terminated} session(s). Failed: ${data.failed}`);
      toast.success(`Terminated ${data.terminated} session(s)`);

      // Clear local storage of rooms
      localStorage.removeItem('recentRooms');
    } catch (error) {
      console.error('Error terminating sessions:', error);
      setDeleteResult('❌ Failed to terminate sessions. Check console for details.');
      toast.error('Failed to terminate sessions');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ScrollArea className="h-[calc(100vh-8rem)]">
      <div className="space-y-6 px-4 py-4 pb-8">
      {/* Profile Section */}
      {user && (
        <>
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Profile</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-center">
                <AvatarUpload
                  currentAvatarUrl={user.avatar}
                  username={user.username || user.name}
                  onUpload={handleAvatarUpload}
                  onRemove={handleAvatarRemove}
                />
              </div>
              
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Username</Label>
                  <p className="text-base font-medium">{user.username || user.name}</p>
                </div>
                {user.email && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />
        </>
      )}

      {/* Hyperbeam API Mode Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Key className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">API Mode</h3>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between gap-6">
              <div className="space-y-1 flex-1">
                <Label htmlFor="api-mode" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                  {useProductionKey ? 'Production Key' : 'Test Key'}
                  <Badge variant={useProductionKey ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                    {useProductionKey ? 'All Features' : 'Limited'}
                  </Badge>
                </Label>
                <p className="text-xs text-muted-foreground">
                  {useProductionKey
                    ? '10,000 free minutes/month with all premium features'
                    : 'Unlimited minutes with restricted features'}
                </p>
              </div>
              <Switch
                id="api-mode"
                checked={useProductionKey}
                onCheckedChange={toggleApiMode}
              />
            </div>

            {/* Info about test mode restrictions */}
            {!useProductionKey && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border">
                <Lock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="space-y-1 flex-1">
                  <p className="text-xs font-medium">Test Mode Restrictions</p>
                  <p className="text-xs text-muted-foreground">
                    Kiosk mode, ad blocker, session reuse (tag), 60 FPS, 1080p resolution, and profile persistence are disabled in test mode.
                  </p>
                </div>
              </div>
            )}

            {/* Info about production mode */}
            {useProductionKey && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-primary/5 border border-primary/20">
                <Zap className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-1 flex-1">
                  <p className="text-xs font-medium text-primary">Production Mode Active</p>
                  <p className="text-xs text-muted-foreground">
                    All premium features enabled. Usage counts towards your 10,000 monthly minutes.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Appearance Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Palette className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Appearance</h3>
        </div>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Dark mode is always enabled for the best viewing experience.
          </p>
        </div>
      </div>

      <Separator />

      {/* Hyperbeam Browser Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Monitor className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Browser Session</h3>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4 space-y-4">
            {/* Kiosk Mode */}
            <div className="flex items-center justify-between gap-6">
              <div className="space-y-1 flex-1">
                <Label htmlFor="kiosk" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                  Kiosk Mode
                  {!useProductionKey && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Premium</Badge>}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {!useProductionKey
                    ? 'Available in production mode only'
                    : 'Hide browser navigation UI for cleaner viewing'}
                </p>
              </div>
              <Switch
                id="kiosk"
                checked={hyperbeamSettings.kiosk}
                onCheckedChange={(checked) => updateHyperbeamSetting('kiosk', checked)}
                disabled={!useProductionKey}
              />
            </div>

            {/* Dark Mode */}
            <div className="flex items-center justify-between gap-6">
              <div className="space-y-1 flex-1">
                <Label htmlFor="dark" className="text-sm font-medium cursor-pointer">
                  Dark Mode
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enable dark theme in the browser
                </p>
              </div>
              <Switch
                id="dark"
                checked={hyperbeamSettings.dark}
                onCheckedChange={(checked) => updateHyperbeamSetting('dark', checked)}
              />
            </div>

            {/* WebGL */}
            <div className="flex items-center justify-between gap-6">
              <div className="space-y-1 flex-1">
                <Label htmlFor="webgl" className="text-sm font-medium cursor-pointer">
                  WebGL Support
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enable WebGL for advanced video players
                </p>
              </div>
              <Switch
                id="webgl"
                checked={hyperbeamSettings.webgl}
                onCheckedChange={(checked) => updateHyperbeamSetting('webgl', checked)}
              />
            </div>

            {/* AdBlock */}
            <div className="flex items-center justify-between gap-6">
              <div className="space-y-1 flex-1">
                <Label htmlFor="adblock" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                  Ad Blocker
                  {useProductionKey ? (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Recommended</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">Premium</Badge>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {!useProductionKey
                    ? 'Available in production mode only'
                    : 'Block ads automatically for better experience'}
                </p>
              </div>
              <Switch
                id="adblock"
                checked={hyperbeamSettings.adblock}
                onCheckedChange={(checked) => updateHyperbeamSetting('adblock', checked)}
                disabled={!useProductionKey}
              />
            </div>

            {/* Session Reuse (Tag) */}
            <div className="flex items-center justify-between gap-6">
              <div className="space-y-1 flex-1">
                <Label htmlFor="useTag" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                  Session Reuse
                  {!useProductionKey && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Premium</Badge>}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {!useProductionKey
                    ? 'Available in production mode only'
                    : 'Reuse existing sessions for the same room (saves resources)'}
                </p>
              </div>
              <Switch
                id="useTag"
                checked={hyperbeamSettings.useTag}
                onCheckedChange={(checked) => updateHyperbeamSetting('useTag', checked)}
                disabled={!useProductionKey}
              />
            </div>

            {/* Drawing Tools */}
            <div className="flex items-center justify-between gap-6">
              <div className="space-y-1 flex-1">
                <Label htmlFor="draw" className="text-sm font-medium cursor-pointer">
                  Drawing Tools
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enable annotation and drawing capabilities
                </p>
              </div>
              <Switch
                id="draw"
                checked={hyperbeamSettings.draw}
                onCheckedChange={(checked) => updateHyperbeamSetting('draw', checked)}
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Performance Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Performance</h3>
        </div>
        <div className="space-y-4">
          {/* Resolution */}
          <div className="space-y-2">
            <Label htmlFor="resolution" className="text-sm font-medium flex items-center gap-2">
              Resolution
              {!useProductionKey && hyperbeamSettings.resolution === '1080p' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Premium</Badge>
              )}
            </Label>
            <Select
              value={hyperbeamSettings.resolution}
              onValueChange={(value: '720p' | '1080p') => {
                // Only allow 1080p in production mode
                if (value === '1080p' && !useProductionKey) {
                  toast.error('1080p resolution requires production mode');
                  return;
                }
                updateHyperbeamSetting('resolution', value);
              }}
            >
              <SelectTrigger id="resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="720p">720p (1280x720) - Standard</SelectItem>
                <SelectItem value="1080p" disabled={!useProductionKey}>
                  1080p (1920x1080) - Full HD {!useProductionKey && '🔒'}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {!useProductionKey
                ? 'HD resolution (1080p) available in production mode only'
                : 'Higher resolution provides better quality but uses more bandwidth'}
            </p>
          </div>

          {/* FPS */}
          <div className="space-y-2">
            <Label htmlFor="fps" className="text-sm font-medium flex items-center gap-2">
              Frame Rate
              {!useProductionKey && hyperbeamSettings.fps === 60 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Premium</Badge>
              )}
            </Label>
            <Select
              value={hyperbeamSettings.fps.toString()}
              onValueChange={(value) => {
                const fpsValue = parseInt(value);
                // Only allow 60 FPS in production mode
                if (fpsValue === 60 && !useProductionKey) {
                  toast.error('60 FPS requires production mode');
                  return;
                }
                updateHyperbeamSetting('fps', fpsValue);
              }}
            >
              <SelectTrigger id="fps">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 FPS (Lower bandwidth)</SelectItem>
                <SelectItem value="30">30 FPS (Balanced)</SelectItem>
                <SelectItem value="60" disabled={!useProductionKey}>
                  60 FPS (Smooth, higher bandwidth) {!useProductionKey && '🔒'}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {!useProductionKey
                ? '60 FPS available in production mode only'
                : 'Higher FPS provides smoother video but uses more bandwidth'}
            </p>
          </div>

          {/* Quality Mode */}
          <div className="space-y-2">
            <Label htmlFor="quality" className="text-sm font-medium">
              Quality Mode
            </Label>
            <Select
              value={hyperbeamSettings.quality}
              onValueChange={(value: 'sharp' | 'smooth' | 'blocky') => updateHyperbeamSetting('quality', value)}
            >
              <SelectTrigger id="quality">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sharp">Sharp (Best for text/UI)</SelectItem>
                <SelectItem value="smooth">Smooth (Best for video)</SelectItem>
                <SelectItem value="blocky">Blocky (Poor connections)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Optimize quality based on content type and connection
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Regional Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Globe className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Regional</h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="region" className="text-sm font-medium flex items-center gap-2">
              Server Region
              {!useProductionKey && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Test Mode</Badge>}
            </Label>
            <Select
              value={hyperbeamSettings.region}
              onValueChange={(value: 'NA' | 'EU' | 'AS') => updateHyperbeamSetting('region', value)}
            >
              <SelectTrigger id="region">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NA">North America</SelectItem>
                <SelectItem value="EU">Europe</SelectItem>
                <SelectItem value="AS">Asia</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {!useProductionKey
                ? 'Region selection enabled for testing - will verify if it\'s a premium feature'
                : 'Choose the region closest to you for best performance'}
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Playback Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Volume2 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Playback</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-6">
            <div className="space-y-1 flex-1">
              <Label htmlFor="auto-play" className="text-sm font-medium cursor-pointer">
                Auto Play
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically play videos when loaded
              </p>
            </div>
            <Switch
              id="auto-play"
              checked={settings.autoPlay}
              onCheckedChange={(checked) => updateSetting('autoPlay', checked)}
            />
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="space-y-1 flex-1">
              <Label htmlFor="sync-playback" className="text-sm font-medium cursor-pointer">
                Sync Playback
              </Label>
              <p className="text-xs text-muted-foreground">
                Keep playback synchronized with all participants
              </p>
            </div>
            <Switch
              id="sync-playback"
              checked={settings.syncPlayback}
              onCheckedChange={(checked) => updateSetting('syncPlayback', checked)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Notifications Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Notifications</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-6">
            <div className="space-y-1 flex-1">
              <Label htmlFor="notify-join" className="text-sm font-medium cursor-pointer">
                User Joins
              </Label>
              <p className="text-xs text-muted-foreground">
                Notify when someone joins the room
              </p>
            </div>
            <Switch
              id="notify-join"
              checked={settings.notifyJoin}
              onCheckedChange={(checked) => updateSetting('notifyJoin', checked)}
            />
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="space-y-1 flex-1">
              <Label htmlFor="notify-leave" className="text-sm font-medium cursor-pointer">
                User Leaves
              </Label>
              <p className="text-xs text-muted-foreground">
                Notify when someone leaves the room
              </p>
            </div>
            <Switch
              id="notify-leave"
              checked={settings.notifyLeave}
              onCheckedChange={(checked) => updateSetting('notifyLeave', checked)}
            />
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="space-y-1 flex-1">
              <Label htmlFor="notify-chat" className="text-sm font-medium cursor-pointer">
                Chat Messages
              </Label>
              <p className="text-xs text-muted-foreground">
                Play sound for new chat messages
              </p>
            </div>
            <Switch
              id="notify-chat"
              checked={settings.notifyChat}
              onCheckedChange={(checked) => updateSetting('notifyChat', checked)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Danger Zone Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h3 className="font-semibold text-destructive">Danger Zone</h3>
        </div>
        <div className="space-y-4 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Force Delete All Sessions</Label>
              <p className="text-xs text-muted-foreground">
                Terminate all active Hyperbeam sessions. Use this if you have orphaned sessions in your dashboard.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isDeleting}
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isDeleting ? 'Terminating...' : 'Force Delete All Sessions'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Are you absolutely sure?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will terminate <strong>ALL</strong> active Hyperbeam sessions in your account.
                    This action cannot be undone. Any users currently in rooms will be disconnected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleForceDeleteAllSessions}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete All Sessions
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {deleteResult && (
              <div className={`text-xs p-2 rounded ${deleteResult.startsWith('✅') ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                {deleteResult}
              </div>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* About Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Info className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">About</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Version</span>
            <Badge variant="secondary" className="text-xs">1.2.0</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Built with</span>
            <Badge variant="outline" className="text-xs">React + Vite + shadcn/ui</Badge>
          </div>
          <p className="text-xs text-muted-foreground pt-2 leading-relaxed">
            Watch videos together in perfect sync with friends. Powered by Hyperbeam.
          </p>

          {/* Debug/Update Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                if (window.electron) {
                  window.electron.send('check-updates');
                  console.log('Manual update check triggered');
                }
              }}
              className="flex-1 px-3 py-2 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Check for Updates
            </button>
            <button
              onClick={() => {
                if (window.electron) {
                  window.electron.send('open-logs');
                }
              }}
              className="flex-1 px-3 py-2 text-xs bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
            >
              Open Logs
            </button>
          </div>
        </div>
      </div>
      </div>
    </ScrollArea>
  );
}
