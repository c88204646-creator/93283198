
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { MessageCircle, X, Send, Minimize2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ChatConversation, ChatMessage } from '@shared/schema';

export function LiveChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: conversations = [] } = useQuery<ChatConversation[]>({
    queryKey: ['/api/chat/conversations'],
    enabled: isOpen,
  });

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ['/api/chat/conversations', currentConversationId, 'messages'],
    enabled: !!currentConversationId,
  });

  const createConversationMutation = useMutation({
    mutationFn: () => apiRequest<ChatConversation>('POST', '/api/chat/conversations'),
    onSuccess: (data) => {
      setCurrentConversationId(data.id);
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => 
      apiRequest('POST', `/api/chat/conversations/${currentConversationId}/messages`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/chat/conversations', currentConversationId, 'messages'] 
      });
      setInputMessage('');
    },
  });

  const archiveConversationMutation = useMutation({
    mutationFn: (conversationId: string) =>
      apiRequest('DELETE', `/api/chat/conversations/${conversationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      setCurrentConversationId(null);
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    
    if (createConversationMutation.isPending) return;
    
    if (!currentConversationId && conversations.length === 0) {
      createConversationMutation.mutate();
    } else if (!currentConversationId && conversations.length > 0) {
      const activeConv = conversations.find(c => c.status === 'active');
      if (activeConv) {
        setCurrentConversationId(activeConv.id);
      }
    }
  }, [isOpen, currentConversationId, conversations.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !currentConversationId) return;
    sendMessageMutation.mutate(inputMessage);
  };

  const handleNewConversation = () => {
    createConversationMutation.mutate();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
          background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.4)';
        }}
      >
        <MessageCircle className="text-white" size={24} strokeWidth={2} />
      </button>
    );
  }

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        left: isMobile ? '24px' : 'auto',
        width: isMobile ? 'auto' : '380px',
        height: isMinimized ? '56px' : (isMobile ? '480px' : '520px'),
        zIndex: 9999,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        borderRadius: '16px',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
      }}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between bg-gradient-to-r from-blue-600 to-purple-600 text-white shrink-0",
        isMobile ? "px-3 py-3" : "px-4 py-3.5"
      )}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={cn(
            "rounded-full bg-white/20 flex items-center justify-center shrink-0",
            isMobile ? "h-8 w-8" : "h-10 w-10"
          )}>
            <MessageCircle className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
          </div>
          <div className="min-w-0">
            <h3 className={cn("font-semibold truncate", isMobile ? "text-sm" : "text-base")}>
              Asistente Virtual
            </h3>
            {!isMobile && (
              <p className="text-xs text-white/80 truncate">Siempre listo para ayudarte</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            className={cn(
              "text-white hover:bg-white/20",
              isMobile ? "h-7 w-7" : "h-8 w-8"
            )}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className={cn(
              "text-white hover:bg-white/20",
              isMobile ? "h-7 w-7" : "h-8 w-8"
            )}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <ScrollArea 
            className={cn("flex-1 overflow-y-auto", isMobile ? "px-3 py-2" : "px-4 py-3")} 
            ref={scrollRef}
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className={cn(
                  "rounded-full bg-gradient-to-r from-blue-100 to-purple-100 flex items-center justify-center mb-3",
                  isMobile ? "h-12 w-12" : "h-16 w-16"
                )}>
                  <MessageCircle className={cn("text-blue-600", isMobile ? "h-6 w-6" : "h-8 w-8")} />
                </div>
                <h4 className={cn("font-semibold mb-2", isMobile ? "text-sm" : "text-base")}>
                  ¡Hola! 👋
                </h4>
                <p className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-sm")}>
                  Soy tu asistente virtual. Puedo ayudarte con operaciones, clientes, empleados y más.
                </p>
                <p className={cn("text-muted-foreground mt-2", isMobile ? "text-xs" : "text-xs")}>
                  Escribe algo para comenzar
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-2",
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className={cn(
                        "rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0",
                        isMobile ? "h-6 w-6" : "h-8 w-8"
                      )}>
                        <MessageCircle className={cn("text-white", isMobile ? "h-3 w-3" : "h-4 w-4")} />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl max-w-[85%]",
                        isMobile ? "px-3 py-1.5" : "px-4 py-2",
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                          : 'bg-muted'
                      )}
                    >
                      <p className={cn("whitespace-pre-wrap", isMobile ? "text-xs" : "text-sm")}>
                        {message.content}
                      </p>
                      <p className={cn(
                        "mt-1",
                        isMobile ? "text-[10px]" : "text-xs",
                        message.role === 'user' ? 'text-white/70' : 'text-muted-foreground'
                      )}>
                        {new Date(message.createdAt).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {message.role === 'user' && (
                      <div className={cn(
                        "rounded-full bg-gradient-to-r from-gray-600 to-gray-700 flex items-center justify-center flex-shrink-0",
                        isMobile ? "h-6 w-6" : "h-8 w-8"
                      )}>
                        <span className={cn("text-white font-semibold", isMobile ? "text-[10px]" : "text-xs")}>
                          Tú
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                {sendMessageMutation.isPending && (
                  <div className="flex gap-2 justify-start">
                    <div className={cn(
                      "rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0",
                      isMobile ? "h-6 w-6" : "h-8 w-8"
                    )}>
                      <MessageCircle className={cn("text-white", isMobile ? "h-3 w-3" : "h-4 w-4")} />
                    </div>
                    <div className={cn("rounded-2xl bg-muted", isMobile ? "px-3 py-1.5" : "px-4 py-2")}>
                      <div className="flex gap-1">
                        <div className={cn(
                          "rounded-full bg-muted-foreground animate-bounce",
                          isMobile ? "h-1.5 w-1.5" : "h-2 w-2"
                        )} style={{ animationDelay: '0ms' }} />
                        <div className={cn(
                          "rounded-full bg-muted-foreground animate-bounce",
                          isMobile ? "h-1.5 w-1.5" : "h-2 w-2"
                        )} style={{ animationDelay: '150ms' }} />
                        <div className={cn(
                          "rounded-full bg-muted-foreground animate-bounce",
                          isMobile ? "h-1.5 w-1.5" : "h-2 w-2"
                        )} style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className={cn("border-t shrink-0", isMobile ? "px-3 py-2.5" : "px-4 py-3")}>
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Escribe tu mensaje..."
                className={cn("flex-1", isMobile ? "text-sm h-9" : "")}
                disabled={sendMessageMutation.isPending}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!inputMessage.trim() || sendMessageMutation.isPending}
                className={cn(
                  "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700",
                  isMobile ? "h-9 w-9" : ""
                )}
              >
                <Send className={isMobile ? "h-3.5 w-3.5" : "h-4 w-4"} />
              </Button>
            </form>
            <div className={cn("flex gap-2", isMobile ? "mt-1.5" : "mt-2")}>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewConversation}
                className={isMobile ? "text-[11px] h-7 px-2" : "text-xs"}
              >
                Nueva conversación
              </Button>
              {currentConversationId && messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => archiveConversationMutation.mutate(currentConversationId)}
                  className={isMobile ? "text-[11px] h-7 px-2" : "text-xs"}
                >
                  <Trash2 className={cn("mr-1", isMobile ? "h-2.5 w-2.5" : "h-3 w-3")} />
                  Archivar
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
