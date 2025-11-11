import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SATCatalogItem, searchSATCatalog } from "@shared/sat-catalogs";

interface SATComboboxProps {
  catalog: SATCatalogItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  allowCustom?: boolean;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  catalogName?: string;
}

export function SATCombobox({
  catalog,
  value,
  onChange,
  placeholder = "Seleccionar...",
  label,
  allowCustom = true,
  required = false,
  disabled = false,
  error,
  catalogName = "SAT",
}: SATComboboxProps) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Buscar en el catálogo
  const filteredCatalog = useMemo(() => {
    return searchSATCatalog(catalog, searchQuery);
  }, [catalog, searchQuery]);

  // Encontrar el item seleccionado
  const selectedItem = catalog.find(item => item.code === value);

  // Manejar selección personalizada
  const handleCustomSubmit = () => {
    if (value.trim()) {
      setCustomMode(false);
      setOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      
      {customMode && allowCustom ? (
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ingresa código personalizado"
            disabled={disabled}
            data-testid={`input-custom-${catalogName.toLowerCase()}`}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setCustomMode(false)}
            disabled={disabled}
          >
            Catálogo
          </Button>
          <Button
            type="button"
            onClick={handleCustomSubmit}
            disabled={disabled || !value.trim()}
          >
            Aplicar
          </Button>
        </div>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-full justify-between",
                !value && "text-muted-foreground",
                error && "border-destructive"
              )}
              disabled={disabled}
              data-testid={`button-select-${catalogName.toLowerCase()}`}
            >
              <span className="truncate">
                {selectedItem 
                  ? `${selectedItem.code} - ${selectedItem.description}`
                  : value || placeholder
                }
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[500px] p-0" align="start">
            <Command shouldFilter={false}>
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder={`Buscar en catálogo ${catalogName}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <CommandList>
                <CommandEmpty>
                  <div className="py-6 text-center text-sm">
                    <p className="text-muted-foreground mb-2">
                      No se encontraron resultados
                    </p>
                    {allowCustom && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCustomMode(true);
                          setOpen(false);
                        }}
                      >
                        Ingresar código personalizado
                      </Button>
                    )}
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {filteredCatalog.slice(0, 50).map((item) => (
                    <CommandItem
                      key={item.code}
                      value={item.code}
                      onSelect={() => {
                        onChange(item.code);
                        setOpen(false);
                        setSearchQuery("");
                      }}
                      data-testid={`option-${catalogName.toLowerCase()}-${item.code}`}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === item.code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{item.code}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {item.description}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                  {filteredCatalog.length > 50 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground text-center border-t">
                      Mostrando 50 de {filteredCatalog.length} resultados. Refina tu búsqueda.
                    </div>
                  )}
                </CommandGroup>
                {allowCustom && filteredCatalog.length > 0 && (
                  <div className="border-t p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setCustomMode(true);
                        setOpen(false);
                      }}
                    >
                      Ingresar código personalizado
                    </Button>
                  </div>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
