import { useState } from 'react';
import { ChevronRight, Check, X, Loader2, Wrench } from 'lucide-react';
import type { ToolCallInfo } from '@/types';

interface ToolPanelProps {
  tool: ToolCallInfo;
}

export function ToolPanel({ tool }: ToolPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = () => {
    switch (tool.status) {
      case 'pending':
        return <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-blue" />;
      case 'success':
        return <Check className="w-3.5 h-3.5 text-accent-green" />;
      case 'error':
        return <X className="w-3.5 h-3.5 text-red-400" />;
      default:
        return <Wrench className="w-3.5 h-3.5 text-text-tertiary" />;
    }
  };

  const statusColor = () => {
    switch (tool.status) {
      case 'pending':
        return 'border-accent-blue/30 bg-accent-blue/5';
      case 'success':
        return 'border-accent-green/30 bg-accent-green/5';
      case 'error':
        return 'border-red-500/30 bg-red-500/5';
      default:
        return 'border-border bg-bg-card';
    }
  };

  const formatJson = (data: any) => {
    if (!data) return '';
    if (typeof data === 'string') {
      try {
        return JSON.stringify(JSON.parse(data), null, 2);
      } catch {
        return data;
      }
    }
    return JSON.stringify(data, null, 2);
  };

  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-bg-card border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
        <Wrench className="w-3 h-3 text-text-tertiary" />
      </div>

      <div className={`flex-1 rounded-lg border ${statusColor()} overflow-hidden`}>
        {/* Header - always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
        >
          {statusIcon()}
          <span className="text-sm font-medium text-text-primary truncate">
            {tool.name}
          </span>
          {tool.status === 'pending' && (
            <span className="text-xs text-text-tertiary ml-1">Running...</span>
          )}
          <ChevronRight
            className={`w-3.5 h-3.5 text-text-tertiary ml-auto transition-transform ${
              expanded ? 'rotate-90' : ''
            }`}
          />
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-border/50">
            {/* Input */}
            {tool.input && (
              <div className="px-3 py-2">
                <div className="text-xs text-text-tertiary uppercase tracking-wider mb-1">
                  Input
                </div>
                <pre className="text-xs text-text-secondary font-mono bg-bg-main rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">
                  {formatJson(tool.input)}
                </pre>
              </div>
            )}

            {/* Output */}
            {tool.output && (
              <div className="px-3 py-2 border-t border-border/50">
                <div className="text-xs text-text-tertiary uppercase tracking-wider mb-1">
                  {tool.status === 'error' ? 'Error' : 'Output'}
                </div>
                <pre
                  className={`text-xs font-mono rounded p-2 overflow-x-auto max-h-60 overflow-y-auto ${
                    tool.status === 'error'
                      ? 'text-red-400 bg-red-500/5'
                      : 'text-text-secondary bg-bg-main'
                  }`}
                >
                  {formatJson(tool.output)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
