'use client'

import { useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { LogOut, User, Settings, Crown, Loader2, Users } from 'lucide-react'
import { ROLE_PERMISSIONS, type UserRole } from '@/lib/permissions'

// ============================================================
// User Menu — Dropdown with profile, role badge, sign out
// ============================================================

export function UserMenu() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [profileOpen, setProfileOpen] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  // User management state (admin)
  const [users, setUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  if (!session?.user) return null

  const user = session.user as any
  const roleInfo = ROLE_PERMISSIONS[user.role as UserRole] ?? ROLE_PERMISSIONS.free
  const initials = (user.name || user.email || 'U').slice(0, 2).toUpperCase()

  const handleOpenProfile = () => {
    setEditName(user.name || '')
    setProfileOpen(true)
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName }),
      })
      if (!res.ok) throw new Error('更新失败')
      toast({ title: '个人信息已更新' })
      setProfileOpen(false)
      // Session will update on next fetch
    } catch (err: any) {
      toast({ title: '更新失败', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    toast({ title: '已退出登录' })
    window.location.reload()
  }

  const handleOpenUsers = async () => {
    setUsersOpen(true)
    setLoadingUsers(true)
    try {
      const res = await fetch('/api/auth/users')
      const data = await res.json()
      if (res.ok) {
        setUsers(data.users)
      } else {
        toast({ title: '获取用户列表失败', description: data.error, variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: '请求失败', variant: 'destructive' })
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleUpdateUserRole = async (userId: string, role: string) => {
    setUpdatingUserId(userId)
    try {
      const res = await fetch('/api/auth/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      })
      const data = await res.json()
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
        toast({ title: '角色已更新' })
      } else {
        toast({ title: '更新失败', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: '更新失败', variant: 'destructive' })
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleToggleUserActive = async (userId: string, isActive: boolean) => {
    setUpdatingUserId(userId)
    try {
      const res = await fetch('/api/auth/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isActive }),
      })
      const data = await res.json()
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive } : u))
        toast({ title: isActive ? '用户已启用' : '用户已禁用' })
      } else {
        toast({ title: '操作失败', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: '操作失败', variant: 'destructive' })
    } finally {
      setUpdatingUserId(null)
    }
  }

  const roleColorMap: Record<string, string> = {
    admin: 'bg-red-500/15 text-red-400 border-red-500/30',
    pro: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    free: 'bg-muted text-muted-foreground border-border',
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative size-9 rounded-full">
            <Avatar className="size-8">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="text-xs bg-primary/15 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col gap-1">
              <span className="font-medium text-sm">{user.name}</span>
              <span className="text-xs text-muted-foreground font-normal">{user.email}</span>
              <Badge
                variant="outline"
                className={`w-fit text-[10px] px-1.5 py-0 ${roleColorMap[user.role] || roleColorMap.free}`}
              >
                {user.role === 'admin' && <Crown className="size-3 mr-1" />}
                {roleInfo.label}
              </Badge>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleOpenProfile}>
            <User className="size-4 mr-2" />
            个人信息
          </DropdownMenuItem>
          {user.role === 'admin' && (
            <DropdownMenuItem onClick={handleOpenUsers}>
              <Users className="size-4 mr-2" />
              用户管理
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
            <LogOut className="size-4 mr-2" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile Edit Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>个人信息</DialogTitle>
            <DialogDescription>修改你的个人资料</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input value={user.email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="输入用户名"
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Input value={roleInfo.label} disabled className="bg-muted" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)}>取消</Button>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin mr-2" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Management Dialog (Admin) */}
      <Dialog open={usersOpen} onOpenChange={setUsersOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>用户管理</DialogTitle>
            <DialogDescription>管理平台用户角色和状态</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">暂无用户</p>
            ) : (
              <div className="space-y-3">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs bg-primary/15 text-primary">
                          {(u.name || 'U').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{u.name}</span>
                          {!u.isActive && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 text-destructive border-destructive/30">
                              已禁用
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={u.role}
                        onValueChange={(role) => handleUpdateUserRole(u.id, role)}
                        disabled={updatingUserId === u.id}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">免费用户</SelectItem>
                          <SelectItem value="pro">专业版</SelectItem>
                          <SelectItem value="admin">管理员</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleToggleUserActive(u.id, !u.isActive)}
                        disabled={updatingUserId === u.id || u.id === user.id}
                      >
                        {u.isActive ? '禁用' : '启用'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
