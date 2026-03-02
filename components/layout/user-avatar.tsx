import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  displayName: string | null | undefined
  avatarUrl: string | null | undefined
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function UserAvatar({ displayName, avatarUrl, className, size = 'md' }: UserAvatarProps) {
  const sizeClass = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
  }[size]

  return (
    <Avatar className={cn(sizeClass, className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName ?? 'User'} />}
      <AvatarFallback className="font-medium">
        {getInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  )
}
