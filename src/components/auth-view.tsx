'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Film, Loader2, Mail, Lock, User, ArrowRight, Sparkles, Shield, Zap } from 'lucide-react'

// ============================================================
// Auth View — Login / Register
// ============================================================

export function AuthView() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Login form
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form
  const [regEmail, setRegEmail] = useState('')
  const [regName, setRegName] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail || !loginPassword) {
      toast({ title: '请输入邮箱和密码', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      })
      if (result?.error) {
        toast({ title: '登录失败', description: result.error, variant: 'destructive' })
      } else {
        toast({ title: '登录成功', description: '欢迎回来！' })
        // Reload to refresh session
        window.location.reload()
      }
    } catch (err: any) {
      toast({ title: '登录异常', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regEmail || !regName || !regPassword) {
      toast({ title: '请填写所有必填项', variant: 'destructive' })
      return
    }
    if (regPassword.length < 6) {
      toast({ title: '密码至少6位', variant: 'destructive' })
      return
    }
    if (regPassword !== regConfirm) {
      toast({ title: '两次密码不一致', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, name: regName, password: regPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: '注册失败', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: '注册成功', description: '请登录你的账号' })
      setTab('login')
      setLoginEmail(regEmail)
      setLoginPassword('')
    } catch (err: any) {
      toast({ title: '注册异常', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-primary/10 mb-4">
            <Film className="size-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">AI短剧创作平台</h1>
          <p className="text-sm text-muted-foreground mt-2">从剧本到成片，一站式短剧制作工作台</p>
        </div>

        {/* Auth Card */}
        <Card className="border-border/60 shadow-xl shadow-black/10">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'register')}>
            <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-border/50">
              <TabsTrigger value="login" className="py-3">登录</TabsTrigger>
              <TabsTrigger value="register" className="py-3">注册</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login" className="mt-0">
              <form onSubmit={handleLogin}>
                <CardHeader className="pb-4 pt-6">
                  <CardTitle className="text-lg">欢迎回来</CardTitle>
                  <CardDescription>登录你的账号继续创作</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm">邮箱</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="your@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-9"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm">密码</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="输入密码"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-9"
                        autoComplete="current-password"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-3 pb-6">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin mr-2" />
                    ) : (
                      <ArrowRight className="size-4 mr-2" />
                    )}
                    {loading ? '登录中...' : '登录'}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register" className="mt-0">
              <form onSubmit={handleRegister}>
                <CardHeader className="pb-4 pt-6">
                  <CardTitle className="text-lg">创建账号</CardTitle>
                  <CardDescription>注册开始你的创作之旅</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-email" className="text-sm">邮箱</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder="your@email.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="pl-9"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-name" className="text-sm">用户名</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="reg-name"
                        type="text"
                        placeholder="输入用户名"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password" className="text-sm">密码</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="reg-password"
                        type="password"
                        placeholder="至少6位密码"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="pl-9"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm" className="text-sm">确认密码</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="reg-confirm"
                        type="password"
                        placeholder="再次输入密码"
                        value={regConfirm}
                        onChange={(e) => setRegConfirm(e.target.value)}
                        className="pl-9"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-3 pb-6">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="size-4 mr-2" />
                    )}
                    {loading ? '注册中...' : '注册'}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Feature highlights */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="size-4 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">AI 智能创作</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="size-4 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">多模型适配</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="size-4 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">角色权限管理</span>
          </div>
        </div>
      </div>
    </div>
  )
}
