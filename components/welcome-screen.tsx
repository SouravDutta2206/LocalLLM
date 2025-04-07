import { Sparkles } from "lucide-react"

export function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full overflow-hidden">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-3xl font-bold">What can I help with?</h1>
        <div className="flex justify-center">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  )
}

