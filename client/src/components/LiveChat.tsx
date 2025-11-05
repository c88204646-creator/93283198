
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { MessageCircle, X, Send, Minimize2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatConversation, ChatMessage } from '@shared/schema';

export function LiveChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: conversations = [] } = useQuery<ChatConversation[]>({
    queryKey: ['/api/chat/conversations'],
    enabled: isOpen,
  });

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ['/api/chat/conversations', currentConversationId, 'messages'],
    enabled: !!currentConversationId,
  });

  const createConversationMutation = useMutation({
    mutationFn: () => apiRequest<ChatConversation>('/api/chat/conversations', {
      method: 'POST',
    }),
    onSuccess: (data) => {
      setCurrentConversationId(data.id);
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => 
      apiRequest(`/api/chat/conversations/${currentConversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/chat/conversations', currentConversationId, 'messages'] 
      });
      setInputMessage('');
    },
  });

  const archiveConversationMutation = useMutation({
    mutationFn: (conversationId: string) =>
      apiRequest(`/api/chat/conversations/${conversationId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      setCurrentConversationId(null);
    },
  });

  useEffect(() => {
    if (isOpen && !currentConversationId && conversations.length === 0) {
      createConversationMutation.mutate();
    } else if (isOpen && !currentConversationId && conversations.length > 0) {
      const activeConv = conversations.find(c => c.status === 'active');
      if (activeConv) {
        setCurrentConversationId(activeConv.id);
      }
    }
  }, [isOpen, currentConversationId, conversations]);

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
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className={cn(
      "fixed bottom-6 right-6 z-50 shadow-2xl transition-all duration-300 overflow-hidden",
      isMinimized ? "h-16 w-80" : "h-[600px] w-96"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Asistente Virtual</h3>
            <p className="text-xs text-white/80">Siempre listo para ayudarte</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-8 w-8 text-white hover:bg-white/20"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <ScrollArea className="h-[440px] p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="h-16 w-16 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 flex items-center justify-center mb-4">
                  <MessageCircle className="h-8 w-8 text-blue-600" />
                </div>
                <h4 className="font-semibold mb-2">¡Hola! 👋</h4>
                <p className="text-sm text-muted-foreground">
                  Soy tu asistente virtual. Puedo ayudarte con operaciones, clientes, empleados y más.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Escribe algo para comenzar
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2 max-w-[80%]",
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                          : 'bg-muted'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className={cn(
                        "text-xs mt-1",
                        message.role === 'user' ? 'text-white/70' : 'text-muted-foreground'
                      )}>
                        {new Date(message.createdAt).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {message.role === 'user' && (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-gray-600 to-gray-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-semibold">Tú</span>
                      </div>
                    )}
                  </div>
                ))}
                {sendMessageMutation.isPending && (
                  <div className="flex gap-3 justify-start">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="h-4 w-4 text-white" />
                    </div>
                    <div className="rounded-2xl px-4 py-2 bg-muted">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Escribe tu mensaje..."
                className="flex-1"
                disabled={sendMessageMutation.isPending}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!inputMessage.trim() || sendMessageMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <div className="flex gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewConversation}
                className="text-xs"
              >
                Nueva conversación
              </Button>
              {currentConversationId && messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => archiveConversationMutation.mutate(currentConversationId)}
                  className="text-xs"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Archivar
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
