import { useState } from 'react';
import { Wrench, ChevronRight, ChevronDown, Check, X, Loader2 } from 'lucide-react';
import type { ToolCallInfo } from '@/types';

interface ToolPanelProps {
  toolCall: ToolCallInfo;
}

export function ToolPanel({ toolCall }: ToolPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (toolCall.status) {
      case 'success':
        return <Check className="w-4 h-4 text-accent-green" />;
      case 'error':
        return <X className="w-4 h-4 text-red-400" />;
      case 'pending':
        return <Loader2 className="w-4 h-4 text-accent-blue animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (toolCall.status) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'pending':
        return 'Running...';
      default:
        return '';
    }
  };

  return (
    <div className="tool-card">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 text-left"
      >
        <Wrench className="w-4 h-4 text-text-secondary flex-shrink-0" />
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">
            {toolCall.name}
          </div>
          <div className="text-xs text-text-secondary flex items-center gap-2">
            {getStatusIcon()}
            <span>{getStatusText()}</span>
          </div>
        </div>

        {expanded ? (
          <ChevronDown className="w-4 h-4 text-text-secondary flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-secondary flex-shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-4 space-y-4 animate-fade-in">
          {/* Input */}
          <div>
            <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
              Input
            </div>
            <pre className="p-3 bg-bg-main rounded-lg text-xs text-text-primary overflow-x-auto border border-border">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {/* Output */}
          {toolCall.output && (
            <div>
              <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
                Output
              </div>
              <pre className="p-3 bg-bg-main rounded-lg text-xs text-text-primary overflow-x-auto border border-border">
                {typeof toolCall.output === 'string'
                  ? toolCall.output
                  : JSON.stringify(toolCall.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
