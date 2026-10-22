'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const local = React.useRef<HTMLDivElement>(null)
  React.useImperativeHandle(ref, () => local.current!)
  React.useLayoutEffect(() => {
    const list = local.current
    if (!list) return
    let frame = 0
    const update = () => {
      frame = 0
      const selected = list.querySelector<HTMLElement>(
        '[role="tab"][data-state="active"]',
      )
      if (!selected) return
      const bounds = list.getBoundingClientRect(),
        rect = selected.getBoundingClientRect()
      list.style.setProperty(
        '--tab-x',
        `${rect.left - bounds.left + list.scrollLeft}px`,
      )
      list.style.setProperty(
        '--tab-y',
        `${rect.top - bounds.top + list.scrollTop}px`,
      )
      list.style.setProperty('--tab-width', `${rect.width}px`)
      list.style.setProperty('--tab-height', `${rect.height}px`)
      list.dataset.motionTabs = 'true'
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const mutations = new MutationObserver(schedule)
    mutations.observe(list, {
      attributes: true,
      attributeFilter: ['data-state'],
      childList: true,
      subtree: true,
    })
    const resize = new ResizeObserver(schedule)
    resize.observe(list)
    update()
    return () => {
      mutations.disconnect()
      resize.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])
  return (
    <TabsPrimitive.List
      ref={local}
      className={cn(
        'relative isolate inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    data-slot="tabs-content"
    ref={ref}
    className={cn('mt-4 focus-visible:outline-none', className)}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
