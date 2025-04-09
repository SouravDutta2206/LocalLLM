import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  
  // Handle ref forwarding manually
  React.useImperativeHandle(ref, () => textareaRef.current!);

  const resizeTextarea = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to auto to recalculate
    textarea.style.height = 'auto';
    // Set the height to the scrollHeight
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  React.useEffect(() => {
    resizeTextarea();
  }, [props.value, resizeTextarea]);

  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={textareaRef}
      onInput={resizeTextarea}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
