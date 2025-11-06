
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Plus, Clock, MapPin, Trash2, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
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
        return apiRequest("POST", "/api/calendar/google-events", data);
      }
      return apiRequest("POST", "/api/calendar/events", data);
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
      return apiRequest("DELETE", `/api/calendar/events/${id}`);
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
    accountId: "local",
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      location: "",
      date: format(new Date(), "yyyy-MM-dd"),
      accountId: "local",
    });
    setEditingEvent(null);
    setLocationCoords(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Establecer horarios predeterminados (todo el día)
    const startDateTime = set(new Date(formData.date), { hours: 0, minutes: 0, seconds: 0 });
    const endDateTime = set(new Date(formData.date), { hours: 23, minutes: 59, seconds: 59 });

    const eventData = {
      ...formData,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      isAllDay: true,
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
    <div className="min-h-screen bg-background p-2 sm:p-3 md:p-4" data-testid="page-calendar">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-2 sm:mb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 bg-primary/5 rounded-lg">
              <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground" data-testid="text-page-title">
                Calendario
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground" data-testid="text-page-description">
                Organiza y gestiona tus eventos
              </p>
            </div>
          </div>
          <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto gap-1.5 sm:gap-2" size="sm" data-testid="button-create-event">
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm">Nuevo Evento</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="dialog-event">
              <DialogHeader>
                <DialogTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Crear Evento
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Añade un nuevo evento a tu calendario
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3 mt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-xs font-medium">Título del Evento *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ej: Reunión con cliente"
                    required
                    className="h-9"
                    data-testid="input-title"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="date" className="text-xs font-medium">Fecha *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="h-9"
                    data-testid="input-date"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs font-medium">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Añade detalles sobre el evento..."
                    rows={2}
                    className="resize-none text-sm"
                    data-testid="input-description"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="location" className="text-xs font-medium">Ubicación</Label>
                  <AddressAutocomplete
                    value={formData.location}
                    onChange={(value) => setFormData({ ...formData, location: value })}
                    placeholder="Buscar o escribir ubicación..."
                    onLocationSelect={(lat, lon) => setLocationCoords([lat, lon])}
                  />
                </div>

                {locationCoords && (
                  <div className="h-32 rounded-lg overflow-hidden border border-border">
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
                  <div className="space-y-1.5">
                    <Label htmlFor="accountId" className="text-xs font-medium">Sincronizar con Google Calendar</Label>
                    <Select
                      value={formData.accountId}
                      onValueChange={(value) => setFormData({ ...formData, accountId: value })}
                    >
                      <SelectTrigger data-testid="select-account" className="h-9">
                        <SelectValue placeholder="Evento local (no sincronizar)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">📌 Evento local</SelectItem>
                        {gmailAccounts.map((account: any) => (
                          <SelectItem key={account.id} value={account.id}>
                            📧 {account.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowEventDialog(false)} 
                    className="w-full sm:w-auto"
                    size="sm"
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createEventMutation.isPending}
                    className="w-full sm:w-auto"
                    size="sm"
                    data-testid="button-submit"
                  >
                    {createEventMutation.isPending ? "Creando..." : "Crear Evento"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3">
        {/* Vista de calendario mensual */}
        <Card className="lg:col-span-8 border shadow-sm">
          <CardHeader className="pb-2 sm:pb-3 border-b p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
              <CardTitle className="text-sm sm:text-base md:text-lg font-semibold capitalize">
                {format(selectedMonth, "MMMM yyyy", { locale: es })}
              </CardTitle>
              <div className="flex gap-1 sm:gap-1.5 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                  className="flex-1 sm:flex-none h-7 sm:h-8 px-2"
                  data-testid="button-prev-month"
                >
                  <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(new Date())}
                  className="flex-1 sm:flex-none h-7 sm:h-8 px-3 font-medium text-[10px] sm:text-xs"
                  data-testid="button-today"
                >
                  Hoy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                  className="flex-1 sm:flex-none h-7 sm:h-8 px-2"
                  data-testid="button-next-month"
                >
                  <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-1.5 sm:p-2 md:p-3">
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {weekDays.map((day) => (
                <div key={day} className="text-center font-semibold text-[9px] sm:text-[10px] md:text-xs p-1 sm:p-1.5 text-muted-foreground uppercase">
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
                      min-h-12 sm:min-h-14 md:min-h-20 p-0.5 sm:p-1 md:p-1.5 border rounded text-left transition-all
                      ${isSelected 
                        ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                        : "hover:bg-accent/50 hover:border-accent"
                      }
                      ${!isCurrentMonth ? "text-muted-foreground/30 opacity-50" : ""}
                      ${isToday && !isSelected ? "border-primary bg-primary/5" : "border-border"}
                    `}
                    data-testid={`day-${format(day, "yyyy-MM-dd")}`}
                  >
                    <div className={`font-semibold text-[9px] sm:text-[10px] md:text-xs mb-0.5 ${isToday && !isSelected ? "text-primary" : ""}`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={`text-[8px] sm:text-[9px] md:text-[10px] truncate px-0.5 sm:px-1 py-0.5 rounded font-medium ${
                            event.isBirthday 
                              ? "bg-pink-500 text-white" 
                              : event.source === "google" 
                                ? "bg-blue-500 text-white" 
                                : "bg-green-500 text-white"
                          }`}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground font-medium px-0.5 sm:px-1">
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
        <Card className="lg:col-span-4 border shadow-sm">
          <CardHeader className="pb-2 border-b p-2 sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xs sm:text-sm md:text-base capitalize font-semibold">
                  {format(selectedDate, "EEEE", { locale: es })}
                </CardTitle>
                <CardDescription className="text-[10px] sm:text-xs font-medium mt-0.5">
                  {format(selectedDate, "d 'de' MMMM", { locale: es })}
                </CardDescription>
              </div>
              <div className={`
                px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-semibold
                ${selectedDayEvents.length > 0 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
                }
              `}>
                {selectedDayEvents.length}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5 sm:space-y-2 p-1.5 sm:p-2 max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-240px)] overflow-y-auto">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8 sm:py-12">
                <CalendarIcon className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 animate-pulse text-primary/30" />
                <p className="font-medium text-xs sm:text-sm">Cargando...</p>
              </div>
            ) : selectedDayEvents.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 sm:py-12">
                <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-2 sm:mb-3 rounded-full bg-primary/5 flex items-center justify-center">
                  <CalendarIcon className="h-6 w-6 sm:h-7 sm:w-7 text-primary/30" />
                </div>
                <p className="font-medium text-xs sm:text-sm">No hay eventos</p>
                <p className="text-[10px] sm:text-xs mt-1">Este día está libre</p>
              </div>
            ) : (
              selectedDayEvents.map((event) => (
                <Card 
                  key={event.id} 
                  className="transition-all border-l-[3px] shadow-sm"
                  style={{
                    borderLeftColor: event.isBirthday 
                      ? "rgb(236 72 153)" 
                      : event.source === "google" 
                        ? "rgb(59 130 246)" 
                        : "rgb(34 197 94)"
                  }}
                  data-testid={`event-${event.id}`}
                >
                  <CardContent className="p-2 sm:p-2.5 space-y-1.5 sm:space-y-2">
                    <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-xs sm:text-sm line-clamp-2">{event.title}</h4>
                        {event.description && (
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteEventMutation.mutate(event.id)}
                        disabled={deleteEventMutation.isPending}
                        className="shrink-0 hover:bg-destructive/10 hover:text-destructive h-6 w-6 sm:h-7 sm:w-7 rounded"
                        data-testid={`button-delete-${event.id}`}
                      >
                        <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </Button>
                    </div>

                    <div className="space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs">
                      <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground bg-muted/50 rounded p-1 sm:p-1.5">
                        <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
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
                        <div className="flex items-start gap-1.5 sm:gap-2 text-muted-foreground bg-muted/50 rounded p-1 sm:p-1.5">
                          <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 mt-0.5" />
                          <span className="text-[9px] sm:text-[11px] line-clamp-2">{event.location}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 sm:gap-1.5 pt-1.5 sm:pt-2 border-t">
                      {event.isBirthday && (
                        <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded bg-pink-500/10 text-pink-700 dark:text-pink-300 font-medium border border-pink-500/20">
                          🎂 Cumpleaños
                        </span>
                      )}
                      <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded font-medium border ${
                        event.source === "google" 
                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20" 
                          : "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20"
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
