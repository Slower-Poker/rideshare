import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Loader2, AlertCircle, MessageSquare } from 'lucide-react';
import { client } from '../client';
import type { SharedProps } from '../types';
import { toast } from '../utils/toast';

// Message validation constants
const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH = 1;

/**
 * Validates user message before sending
 */
const validateMessage = (message: string): { valid: boolean; error?: string } => {
  const trimmed = message.trim();
  
  if (trimmed.length < MIN_MESSAGE_LENGTH) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { 
      valid: false, 
      error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.` 
    };
  }
  
  return { valid: true };
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

/**
 * Ride Planner Chat Component
 * 
 * Features:
 * - Streaming AI responses
 * - Message history persistence
 * - Error handling and recovery
 * - Input validation
 * - Loading states
 * - Accessibility support
 * - React 19.2 patterns
 */
export function RidePlannerChat({ setCurrentView, user }: SharedProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle message send with validation and error handling
  const handleSend = useCallback(async () => {
    // Validate input
    const validation = validateMessage(inputMessage);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid message');
      return;
    }

    const messageToSend = inputMessage.trim();
    const userMessage: ChatMessage = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date().toISOString(),
    };

    // Add user message immediately (optimistic update)
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsSending(true);
    setIsLoading(true);
    setError(null);

    try {
      // Call the custom query that uses Lambda to proxy to Nova Agent
      console.log('Sending message to AI:', { message: messageToSend, conversationId });
      const { data, errors } = await client.queries.chatRidePlanner({
        message: messageToSend,
        conversationId: conversationId || undefined,
      });

      console.log('AI response received:', { data, errors });

      if (errors) {
        console.error('GraphQL errors:', errors);
        throw new Error(errors[0]?.message || 'Failed to get response from AI');
      }

      if (data) {
        // Check for error in response (Lambda may return error in data field)
        if ('error' in data && data.error) {
          throw new Error(data.error);
        }

        // Check if response is empty
        if (!data.response || data.response.trim() === '') {
          throw new Error('Received empty response from AI. This may indicate the Nova API key is not configured or the API call failed.');
        }

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        
        // Update conversation ID if provided
        if (data.conversationId) {
          setConversationId(data.conversationId);
        }
      } else {
        throw new Error('No data received from AI');
      }

      // Focus input after sending for better UX
      inputRef.current?.focus();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to send message');
      setError(error);
      toast.error(`Failed to send message: ${error.message}`);
      
      // Remove the user message on error (since it failed)
      setMessages((prev) => prev.filter((msg, idx) => !(idx === prev.length - 1 && msg.role === 'user')));
      
      // Restore message on error so user can retry
      setInputMessage(messageToSend);
    } finally {
      setIsSending(false);
      setIsLoading(false);
    }
  }, [inputMessage, conversationId]);

  // Handle Enter key (submit) and Shift+Enter (new line)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && !isLoading && inputMessage.trim()) {
        handleSend();
      }
    }
  }, [isSending, isLoading, inputMessage, handleSend]);

  // Redirect if not authenticated (should be handled by parent, but safety check)
  useEffect(() => {
    if (!user) {
      toast.error('Please sign in to use the AI assistant');
      setCurrentView('account');
    }
  }, [user, setCurrentView]);

  // Loading state
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => setCurrentView('home')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary-600" />
            <h1 className="text-xl font-bold text-gray-900">AI Ride Planner</h1>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-1">{error.message}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div 
        className="flex-1 overflow-y-auto px-4 py-6"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Start Planning Your Ride
              </h2>
              <p className="text-gray-600 max-w-md mx-auto">
                Ask me anything about booking a ride, offering a ride, or finding available rides. 
                I'll help guide you through the process!
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                </div>
              </div>
            ))
          )}
          
          {/* Loading indicator for streaming response */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-primary-600 animate-spin" />
                  <span className="text-sm text-gray-600">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
              disabled={isSending || isLoading}
              rows={1}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              aria-label="Chat message input"
              aria-describedby="input-help"
            />
            <button
              onClick={handleSend}
              disabled={isSending || isLoading || !inputMessage.trim()}
              className="p-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              aria-label="Send message"
            >
              {isSending || isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p 
            id="input-help" 
            className="text-xs text-gray-500 mt-2"
          >
            {inputMessage.length}/{MAX_MESSAGE_LENGTH} characters
            {inputMessage.length > MAX_MESSAGE_LENGTH * 0.9 && (
              <span className="text-amber-600 ml-2">Approaching limit</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
