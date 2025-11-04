import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Plus, Clock, MapPin, Users, Trash2, RefreshCw } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { CalendarEvent } from "@shared/schema";

export default function Calendar() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events"],
  });

  const { data: gmailAccounts = [] } = useQuery({
    queryKey: ["/api/gmail/accounts"],
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.accountId) {
        return apiRequest("/api/calendar/google-events", "POST", data);
      }
      return apiRequest("/api/calendar/events", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({ title: "Evento creado exitosamente" });
      setShowEventDialog(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error al crear evento", variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/calendar/events/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({ title: "Evento eliminado" });
    },
    onError: () => {
      toast({ title: "Error al eliminar evento", variant: "destructive" });
    },
  });

  const syncCalendarMutation = useMutation({
    mutationFn: async (accountId: string) => {
      return apiRequest(`/api/calendar/accounts/${accountId}/sync`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({ title: "Calendario sincronizado" });
    },
    onError: () => {
      toast({ title: "Error al sincronizar", variant: "destructive" });
    },
  });

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    startTime: "",
    endTime: "",
    isAllDay: false,
    accountId: "",
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      location: "",
      startTime: "",
      endTime: "",
      isAllDay: false,
      accountId: "",
    });
    setEditingEvent(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEventMutation.mutate(formData);
  };

  // Obtener días del calendario
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const calendarStart = startOfWeek(monthStart, { locale: es });
  const calendarEnd = endOfWeek(monthEnd, { locale: es });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Filtrar eventos del día seleccionado
  const selectedDayEvents = events.filter(event => {
    const eventDate = parseISO(event.startTime.toString());
    return isSameDay(eventDate, selectedDate);
  });

  // Función para obtener eventos de un día específico
  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventDate = parseISO(event.startTime.toString());
      return isSameDay(eventDate, day);
    });
  };

  const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return (
    <div className="p-6 space-y-6" data-testid="page-calendar">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <CalendarIcon className="h-8 w-8" />
            Calendario
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Gestiona tus eventos y sincroniza con Google Calendar
          </p>
        </div>
        <div className="flex gap-2">
          {gmailAccounts.length > 0 && (
            <Button
              variant="outline"
              onClick={() => syncCalendarMutation.mutate(gmailAccounts[0].id)}
              disabled={syncCalendarMutation.isPending}
              data-testid="button-sync"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar
            </Button>
          )}
          <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-event">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl" data-testid="dialog-event">
              <DialogHeader>
                <DialogTitle>Crear Evento</DialogTitle>
                <DialogDescription>
                  Crea un evento local o sincronízalo con Google Calendar
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    data-testid="input-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    data-testid="input-description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Ubicación</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    data-testid="input-location"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Inicio *</Label>
                    <Input
                      id="startTime"
                      type="datetime-local"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required
                      data-testid="input-start-time"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endTime">Fin *</Label>
                    <Input
                      id="endTime"
                      type="datetime-local"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      required
                      data-testid="input-end-time"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isAllDay"
                    checked={formData.isAllDay}
                    onCheckedChange={(checked) => setFormData({ ...formData, isAllDay: checked })}
                    data-testid="switch-all-day"
                  />
                  <Label htmlFor="isAllDay">Todo el día</Label>
                </div>

                {gmailAccounts.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="accountId">Sincronizar con Google Calendar</Label>
                    <Select
                      value={formData.accountId}
                      onValueChange={(value) => setFormData({ ...formData, accountId: value })}
                    >
                      <SelectTrigger data-testid="select-account">
                        <SelectValue placeholder="Evento local (no sincronizar)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Evento local (no sincronizar)</SelectItem>
                        {gmailAccounts.map((account: any) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowEventDialog(false)} data-testid="button-cancel">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createEventMutation.isPending} data-testid="button-submit">
                    {createEventMutation.isPending ? "Creando..." : "Crear Evento"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vista de calendario mensual */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {format(selectedMonth, "MMMM yyyy", { locale: es })}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                  data-testid="button-prev-month"
                >
                  ←
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(new Date())}
                  data-testid="button-today"
                >
                  Hoy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                  data-testid="button-next-month"
                >
                  →
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day) => (
                <div key={day} className="text-center font-semibold text-sm p-2">
                  {day}
                </div>
              ))}
              {calendarDays.map((day, idx) => {
                const dayEvents = getEventsForDay(day);
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, selectedMonth);
                const isToday = isSameDay(day, new Date());

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      min-h-20 p-2 border rounded-md text-left hover-elevate active-elevate-2 transition-all
                      ${isSelected ? "bg-primary text-primary-foreground" : ""}
                      ${!isCurrentMonth ? "text-muted-foreground" : ""}
                      ${isToday && !isSelected ? "border-primary border-2" : ""}
                    `}
                    data-testid={`day-${format(day, "yyyy-MM-dd")}`}
                  >
                    <div className="font-semibold">{format(day, "d")}</div>
                    <div className="space-y-1 mt-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={`text-xs truncate px-1 rounded ${
                            event.source === "google" ? "bg-blue-500/20 text-blue-600" : "bg-green-500/20 text-green-600"
                          }`}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayEvents.length - 2} más
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Panel lateral con eventos del día */}
        <Card>
          <CardHeader>
            <CardTitle>{format(selectedDate, "d 'de' MMMM", { locale: es })}</CardTitle>
            <CardDescription>
              {selectedDayEvents.length} evento{selectedDayEvents.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="text-center text-muted-foreground">Cargando...</div>
            ) : selectedDayEvents.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No hay eventos para este día
              </div>
            ) : (
              selectedDayEvents.map((event) => (
                <Card key={event.id} className="hover-elevate" data-testid={`event-${event.id}`}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold">{event.title}</h4>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {event.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteEventMutation.mutate(event.id)}
                        disabled={deleteEventMutation.isPending}
                        data-testid={`button-delete-${event.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {event.isAllDay ? (
                          "Todo el día"
                        ) : (
                          <>
                            {format(parseISO(event.startTime.toString()), "HH:mm")} -{" "}
                            {format(parseISO(event.endTime.toString()), "HH:mm")}
                          </>
                        )}
                      </div>

                      {event.location && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {event.location}
                        </div>
                      )}

                      {event.attendees && Array.isArray(event.attendees) && event.attendees.length > 0 && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          {event.attendees.length} asistente{event.attendees.length !== 1 ? "s" : ""}
                        </div>
                      )}

                      <div className="mt-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          event.source === "google" ? "bg-blue-500/20 text-blue-600" : "bg-green-500/20 text-green-600"
                        }`}>
                          {event.source === "google" ? "Google Calendar" : "Local"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
