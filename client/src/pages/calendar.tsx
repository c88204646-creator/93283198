
import { useState, useEffect, useRef } from "react";
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
import { Calendar as CalendarIcon, Plus, Clock, MapPin, Users, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO, set } from "date-fns";
import { es } from "date-fns/locale";
import type { CalendarEvent } from "@shared/schema";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

function AddressAutocomplete({ 
  value, 
  onChange, 
  placeholder,
  onLocationSelect 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  placeholder: string;
  onLocationSelect?: (lat: number, lon: number) => void;
}) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&addressdetails=1&extratags=1`
        );
        const data = await response.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value]);

  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    onChange(suggestion.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    if (onLocationSelect) {
      onLocationSelect(parseFloat(suggestion.lat), parseFloat(suggestion.lon));
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (e.target.value.length >= 3) {
              setShowSuggestions(true);
            }
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          rows={2}
          className="pl-10 resize-none"
        />
      </div>
      {isLoading && (
        <div className="absolute top-full mt-1 w-full bg-popover border border-border rounded-md p-2 text-sm text-muted-foreground z-50">
          Buscando direcciones...
        </div>
      )}
      {!isLoading && value.length >= 3 && suggestions.length === 0 && showSuggestions && (
        <div className="absolute top-full mt-1 w-full bg-popover border border-border rounded-md p-3 text-sm text-muted-foreground z-50">
          <p className="text-center">No se encontraron sugerencias.</p>
          <p className="text-center text-xs mt-1">Puedes escribir la dirección manualmente.</p>
        </div>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full text-left px-4 py-2 hover:bg-accent text-sm border-b border-border last:border-b-0 transition-colors"
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-xs">{suggestion.display_name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Calendar() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [locationCoords, setLocationCoords] = useState<[number, number] | null>(null);

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events"],
  });

  const { data: gmailAccounts = [] } = useQuery({
    queryKey: ["/api/gmail/accounts"],
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.accountId && data.accountId !== "local") {
        return apiRequest("/api/calendar/google-events", "POST", data);
      }
      return apiRequest("/api/calendar/events", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({ title: "✓ Evento creado exitosamente" });
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
      toast({ title: "✓ Evento eliminado" });
    },
    onError: () => {
      toast({ title: "Error al eliminar evento", variant: "destructive" });
    },
  });

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "",
    endTime: "",
    isAllDay: true,
    accountId: "local",
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      location: "",
      date: format(new Date(), "yyyy-MM-dd"),
      startTime: "",
      endTime: "",
      isAllDay: true,
      accountId: "local",
    });
    setEditingEvent(null);
    setLocationCoords(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Si es todo el día, establecer horarios predeterminados
    let startDateTime, endDateTime;
    if (formData.isAllDay) {
      startDateTime = set(new Date(formData.date), { hours: 0, minutes: 0, seconds: 0 });
      endDateTime = set(new Date(formData.date), { hours: 23, minutes: 59, seconds: 59 });
    } else {
      const [startHour, startMinute] = formData.startTime.split(':').map(Number);
      const [endHour, endMinute] = formData.endTime.split(':').map(Number);
      startDateTime = set(new Date(formData.date), { hours: startHour, minutes: startMinute, seconds: 0 });
      endDateTime = set(new Date(formData.date), { hours: endHour, minutes: endMinute, seconds: 0 });
    }

    const eventData = {
      ...formData,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
    };

    createEventMutation.mutate(eventData);
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
    <div className="min-h-screen p-3 sm:p-6 space-y-4 sm:space-y-6" data-testid="page-calendar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <CalendarIcon className="h-6 w-6 sm:h-8 sm:w-8" />
            Calendario
          </h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-description">
            Gestiona tus eventos y sincroniza con Google Calendar
          </p>
        </div>
        <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto shadow-lg" size="lg" data-testid="button-create-event">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-event">
            <DialogHeader>
              <DialogTitle className="text-xl">Crear Evento</DialogTitle>
              <DialogDescription>
                Crea un evento local o sincronízalo con Google Calendar
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-semibold">Título del Evento *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ej: Reunión con cliente"
                  required
                  className="text-base"
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-semibold">Fecha *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="text-base"
                  data-testid="input-date"
                />
              </div>

              <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                <Switch
                  id="isAllDay"
                  checked={formData.isAllDay}
                  onCheckedChange={(checked) => setFormData({ ...formData, isAllDay: checked })}
                  data-testid="switch-all-day"
                />
                <Label htmlFor="isAllDay" className="text-sm font-medium cursor-pointer">
                  Evento de todo el día
                </Label>
              </div>

              {!formData.isAllDay && (
                <div className="grid grid-cols-2 gap-4 p-3 border border-border rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="startTime" className="text-sm font-semibold">Hora Inicio</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required={!formData.isAllDay}
                      className="text-base"
                      data-testid="input-start-time"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime" className="text-sm font-semibold">Hora Fin</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      required={!formData.isAllDay}
                      className="text-base"
                      data-testid="input-end-time"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-semibold">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Añade detalles sobre el evento..."
                  rows={3}
                  className="resize-none text-base"
                  data-testid="input-description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="text-sm font-semibold">Ubicación</Label>
                <AddressAutocomplete
                  value={formData.location}
                  onChange={(value) => setFormData({ ...formData, location: value })}
                  placeholder="Buscar o escribir ubicación..."
                  onLocationSelect={(lat, lon) => setLocationCoords([lat, lon])}
                />
              </div>

              {locationCoords && (
                <div className="h-[180px] rounded-lg overflow-hidden border-2 border-border shadow-sm">
                  <MapContainer
                    center={locationCoords}
                    zoom={15}
                    style={{ height: "100%", width: "100%" }}
                    className="z-0"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                    <Marker position={locationCoords} />
                  </MapContainer>
                </div>
              )}

              {gmailAccounts.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="accountId" className="text-sm font-semibold">Sincronizar con Google Calendar</Label>
                  <Select
                    value={formData.accountId}
                    onValueChange={(value) => setFormData({ ...formData, accountId: value })}
                  >
                    <SelectTrigger data-testid="select-account" className="text-base">
                      <SelectValue placeholder="Evento local (no sincronizar)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">📌 Evento local (no sincronizar)</SelectItem>
                      {gmailAccounts.map((account: any) => (
                        <SelectItem key={account.id} value={account.id}>
                          📧 {account.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowEventDialog(false)} 
                  className="w-full sm:w-auto"
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createEventMutation.isPending}
                  className="w-full sm:w-auto shadow-lg"
                  data-testid="button-submit"
                >
                  {createEventMutation.isPending ? "Creando..." : "Crear Evento"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Vista de calendario mensual */}
        <Card className="xl:col-span-2 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-xl sm:text-2xl font-bold capitalize">
                {format(selectedMonth, "MMMM yyyy", { locale: es })}
              </CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                  className="flex-1 sm:flex-none"
                  data-testid="button-prev-month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(new Date())}
                  className="flex-1 sm:flex-none"
                  data-testid="button-today"
                >
                  Hoy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                  className="flex-1 sm:flex-none"
                  data-testid="button-next-month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-6">
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {weekDays.map((day) => (
                <div key={day} className="text-center font-bold text-xs sm:text-sm p-1 sm:p-2 text-muted-foreground">
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
                      min-h-14 sm:min-h-20 p-1 sm:p-2 border-2 rounded-lg text-left transition-all duration-200
                      ${isSelected ? "bg-primary text-primary-foreground shadow-lg scale-105 border-primary" : "hover:bg-accent hover:shadow-md hover:scale-102"}
                      ${!isCurrentMonth ? "text-muted-foreground opacity-50" : ""}
                      ${isToday && !isSelected ? "border-primary bg-primary/5" : "border-border"}
                    `}
                    data-testid={`day-${format(day, "yyyy-MM-dd")}`}
                  >
                    <div className={`font-bold text-xs sm:text-sm mb-1 ${isToday && !isSelected ? "text-primary" : ""}`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={`text-[9px] sm:text-xs truncate px-1 py-0.5 rounded-sm font-medium ${
                            event.isBirthday 
                              ? "bg-pink-500/90 text-white" 
                              : event.source === "google" 
                                ? "bg-blue-500/90 text-white" 
                                : "bg-green-500/90 text-white"
                          }`}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[9px] sm:text-xs text-muted-foreground font-medium px-1">
                          +{dayEvents.length - 2}
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
        <Card className="shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg sm:text-xl capitalize">
                  {format(selectedDate, "EEEE", { locale: es })}
                </CardTitle>
                <CardDescription className="text-lg font-semibold mt-1">
                  {format(selectedDate, "d 'de' MMMM", { locale: es })}
                </CardDescription>
              </div>
              <div className={`
                px-3 py-1 rounded-full text-sm font-bold
                ${selectedDayEvents.length > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}
              `}>
                {selectedDayEvents.length}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-12">
                <CalendarIcon className="h-12 w-12 mx-auto mb-3 animate-pulse" />
                <p>Cargando eventos...</p>
              </div>
            ) : selectedDayEvents.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <CalendarIcon className="h-16 w-16 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No hay eventos</p>
                <p className="text-sm mt-1">Este día está libre</p>
              </div>
            ) : (
              selectedDayEvents.map((event) => (
                <Card 
                  key={event.id} 
                  className="hover:shadow-md transition-shadow border-l-4"
                  style={{
                    borderLeftColor: event.isBirthday 
                      ? "rgb(236 72 153)" 
                      : event.source === "google" 
                        ? "rgb(59 130 246)" 
                        : "rgb(34 197 94)"
                  }}
                  data-testid={`event-${event.id}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-base sm:text-lg truncate">{event.title}</h4>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteEventMutation.mutate(event.id)}
                        disabled={deleteEventMutation.isPending}
                        className="shrink-0 hover:bg-destructive/10"
                        data-testid={`button-delete-${event.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span className="font-medium">
                          {event.isAllDay ? (
                            "Todo el día"
                          ) : (
                            <>
                              {format(parseISO(event.startTime.toString()), "HH:mm")} - {format(parseISO(event.endTime.toString()), "HH:mm")}
                            </>
                          )}
                        </span>
                      </div>

                      {event.location && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                          <span className="text-xs line-clamp-2">{event.location}</span>
                        </div>
                      )}

                      {event.attendees && Array.isArray(event.attendees) && event.attendees.length > 0 && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4 shrink-0" />
                          <span className="font-medium">{event.attendees.length} asistente{event.attendees.length !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      {event.isBirthday && (
                        <span className="text-xs px-2 py-1 rounded-full bg-pink-500/20 text-pink-700 dark:text-pink-300 font-semibold">
                          🎂 Cumpleaños
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        event.source === "google" 
                          ? "bg-blue-500/20 text-blue-700 dark:text-blue-300" 
                          : "bg-green-500/20 text-green-700 dark:text-green-300"
                      }`}>
                        {event.source === "google" ? "📧 Google" : "📌 Local"}
                      </span>
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
