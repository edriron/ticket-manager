'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Ticket, Settings } from 'lucide-react'
import Image from 'next/image'
import logo from '@/app/logo.png'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    href: '/tickets',
    label: 'Tickets',
    icon: Ticket,
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-56 border-r bg-background min-h-screen shrink-0">
      <div className="flex items-center gap-2 h-14 px-4 border-b">
        <Image src={logo} alt="TrackIt" width={20} height={20} className="h-5 w-5 object-contain" />
        <span className="font-semibold text-base tracking-tight">TrackIt</span>
      </div>

      <nav className="flex flex-col gap-1 p-3 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Button
              key={item.href}
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn(
                'justify-start gap-2 h-9',
                isActive && 'font-medium'
              )}
              asChild
            >
              <Link href={item.href}>
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            </Button>
          )
        })}
      </nav>
    </aside>
  )
}
