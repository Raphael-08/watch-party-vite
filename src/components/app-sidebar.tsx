import * as React from "react"
import {
  Video,
  Home,
  Clapperboard,
  Users,
  Settings,
  LogOut,
  ChevronRight,
  Trash2,
  UserPlus,
  MessageCircle,
} from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: {
    name: string;
    email?: string;
    avatar?: string;
  };
  recentRooms?: Array<{
    code: string;
    name?: string;
    lastJoined?: string;
  }>;
  currentView?: string;
  onNavigate?: (view: 'lobby' | 'room' | 'social' | 'social-friends' | 'social-requests' | 'social-messages') => void;
  onJoinRoom?: (code: string) => void;
  onDeleteRoom?: (code: string) => void;
  onLogout?: () => void;
  onOpenSettings?: () => void;
}

export function AppSidebar({
  user,
  recentRooms = [],
  currentView,
  onNavigate,
  onJoinRoom,
  onDeleteRoom,
  onLogout,
  onOpenSettings,
  ...props
}: AppSidebarProps) {
  const userInitial = user?.name?.charAt(0).toUpperCase() || 'U'

  return (
    <Sidebar variant="inset" className="transition-all duration-300 ease-in-out" {...props}>
      <SidebarHeader className="-mt-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <button onClick={() => onNavigate?.('lobby')}>
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Video className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Watch Party</span>
                  <span className="truncate text-xs">Stream Together</span>
                </div>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarMenu>
            {/* Home - Not collapsible */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onNavigate?.('lobby')}
                isActive={currentView === 'lobby'}
              >
                <Home className="size-4" />
                <span>Home</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Rooms - Collapsible with room list */}
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton isActive={currentView === 'room'}>
                    <Clapperboard className="size-4" />
                    <span>Rooms</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {recentRooms.length === 0 ? (
                      <div className="px-8 py-2 text-xs text-muted-foreground">
                        No rooms yet
                      </div>
                    ) : (
                      recentRooms.map((room) => (
                        <SidebarMenuSubItem key={room.code}>
                          <SidebarMenuSubButton
                            onClick={() => onJoinRoom?.(room.code)}
                            className="group/room"
                          >
                            <span className="text-xs font-medium truncate flex-1 min-w-0">{room.name || room.code}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-auto h-4 w-4 opacity-0 group-hover/room:opacity-100 transition-opacity flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteRoom?.(room.code)
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))
                    )}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            {/* Social - Collapsible with Friends, Requests, Messages */}
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton isActive={currentView?.startsWith('social')}>
                    <Users className="size-4" />
                    <span>Social</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        onClick={() => onNavigate?.('social-friends')}
                        isActive={currentView === 'social-friends'}
                      >
                        <Users className="size-4" />
                        <span>Friends</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        onClick={() => onNavigate?.('social-requests')}
                        isActive={currentView === 'social-requests'}
                      >
                        <UserPlus className="size-4" />
                        <span>Requests</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        onClick={() => onNavigate?.('social-messages')}
                        isActive={currentView === 'social-messages'}
                      >
                        <MessageCircle className="size-4" />
                        <span>Messages</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroup>

        {/* Settings */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onOpenSettings}>
                  <Settings className="size-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                    <Avatar className="h-8 w-8 rounded-lg">
                      {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                      <AvatarFallback className="rounded-lg bg-primary/20 text-primary">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email || 'Guest'}
                      </span>
                    </div>
                    <ChevronRight className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email || 'Guest'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
