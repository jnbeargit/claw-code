import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { ToolCallInfo } from '@/types';

interface ToolPanelProps {
  toolCall: ToolCallInfo;
}

export function ToolPanel({ toolCall }: ToolPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    pending: <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />,
    success: <CheckCircle className="w-4 h-4 text-green-400" />,
    error: <XCircle className="w-4 h-4 text-red-400" />,
  }[toolCall.status];

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-900 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          {statusIcon}
          <span className="font-medium">{toolCall.name}</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {expanded && (
        <div className="p-3 bg-gray-950 space-y-3">
          <div>
            <div className="text-sm font-medium text-gray-400 mb-1">Input</div>
            <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {toolCall.output && (
            <div>
              <div className="text-sm font-medium text-gray-400 mb-1">
                {toolCall.status === 'error' ? 'Error' : 'Output'}
              </div>
              <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto">
                {JSON.stringify(toolCall.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
