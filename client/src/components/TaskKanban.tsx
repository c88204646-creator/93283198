import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckSquare,
  Clock,
  User as UserIcon,
  Calendar,
  Zap,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  PlayCircle,
  FileCheck,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { OperationTask, Employee, User } from "@shared/schema";

type KanbanStatus = "pending" | "in-progress" | "pending-approval" | "completed" | "cancelled";

interface KanbanColumn {
  id: KanbanStatus;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: "pending",
    title: "Pendientes",
    icon: AlertCircle,
    color: "text-gray-700 dark:text-gray-300",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  {
    id: "in-progress",
    title: "En Proceso",
    icon: PlayCircle,
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-800",
  },
  {
    id: "pending-approval",
    title: "Por Aprobar",
    icon: FileCheck,
    color: "text-yellow-700 dark:text-yellow-300",
    bgColor: "bg-yellow-100 dark:bg-yellow-800",
  },
  {
    id: "completed",
    title: "Finalizadas",
    icon: CheckCircle2,
    color: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-100 dark:bg-green-800",
  },
  {
    id: "cancelled",
    title: "Canceladas",
    icon: XCircle,
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-100 dark:bg-red-800",
  },
];

interface TaskKanbanProps {
  operationId: string;
  tasks: OperationTask[];
  employees: Employee[];
  users: User[];
  onAddTask: () => void;
  onEditTask: (task: OperationTask) => void;
  onDeleteTask: (taskId: string) => void;
}

function TaskCard({
  task,
  employees,
  users,
  onEdit,
  onDelete,
  isDragging = false,
}: {
  task: OperationTask;
  employees: Employee[];
  users: User[];
  onEdit: () => void;
  onDelete: () => void;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isSortableDragging ? 0.5 : 1,
  };

  const assignedEmployee = employees.find((e) => e.id === task.assignedToId);
  const createdByUser = users.find((u) => u.id === task.createdById);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="mb-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
      data-testid={`kanban-task-${task.id}`}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          {/* Header con badges */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              <Badge className={getPriorityColor(task.priority)} data-testid={`badge-priority-${task.id}`}>
                {task.priority === "low"
                  ? "Baja"
                  : task.priority === "medium"
                  ? "Media"
                  : task.priority === "high"
                  ? "Alta"
                  : "Urgente"}
              </Badge>
              {task.createdAutomatically && (
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 border-blue-300">
                  <Zap className="w-3 h-3 mr-1" />
                  IA
                </Badge>
              )}
              {task.modifiedManually && (
                <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950 border-purple-300">
                  <Edit2 className="w-3 h-3 mr-1" />
                  Editado
                </Badge>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit} data-testid={`button-edit-task-${task.id}`}>
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onDelete} data-testid={`button-delete-task-${task.id}`}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Título */}
          <h4 className="font-semibold text-sm line-clamp-2" data-testid={`text-task-title-${task.id}`}>
            {task.title}
          </h4>

          {/* Descripción */}
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-task-description-${task.id}`}>
              {task.description}
            </p>
          )}

          {/* Metadata */}
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            {assignedEmployee && (
              <div className="flex items-center gap-1">
                <UserIcon className="w-3 h-3" />
                <span className="truncate">{assignedEmployee.name}</span>
              </div>
            )}
            {task.dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(task.dueDate), "dd MMM yyyy")}</span>
              </div>
            )}
            {task.aiConfidence && (
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <span>Confianza: {task.aiConfidence}%</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TaskKanban({
  operationId,
  tasks,
  employees,
  users,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: TaskKanbanProps) {
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: KanbanStatus }) => {
      return apiRequest("PATCH", `/api/operations/${operationId}/tasks/${taskId}`, {
        status,
        modifiedManually: true,
        completedAt: status === "completed" ? new Date().toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/operations/${operationId}/tasks`] });
      toast({ title: "Tarea actualizada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al actualizar la tarea", variant: "destructive" });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Check if dropped on a column
    const overColumn = KANBAN_COLUMNS.find((col) => over.id === col.id);
    if (overColumn && activeTask.status !== overColumn.id) {
      updateTaskStatusMutation.mutate({
        taskId: activeTask.id,
        status: overColumn.id,
      });
    }

    setActiveId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over for visual feedback
  };

  const getTasksByStatus = (status: KanbanStatus) => {
    return tasks.filter((task) => task.status === status);
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Tablero Kanban</h3>
          <p className="text-sm text-muted-foreground">
            Arrastra las tareas entre columnas para cambiar su estado
          </p>
        </div>
        <Button onClick={onAddTask} data-testid="button-add-task-kanban">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Tarea
        </Button>
      </div>

      {/* Kanban Board - Horizontal Scrollable */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {KANBAN_COLUMNS.map((column) => {
              const columnTasks = getTasksByStatus(column.id);
              const Icon = column.icon;

              return (
                <div key={column.id} className="flex flex-col w-80 min-h-[500px]">
                  {/* Column Header */}
                  <div className={`${column.bgColor} ${column.color} rounded-t-lg p-3 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span className="font-semibold text-sm">{column.title}</span>
                    </div>
                    <Badge variant="secondary" className="bg-white/20">
                      {columnTasks.length}
                    </Badge>
                  </div>

                  {/* Droppable Column Area */}
                  <div
                    id={column.id}
                    className="flex-1 bg-muted/30 rounded-b-lg p-3 overflow-y-auto"
                    style={{ minHeight: "200px" }}
                  >
                    <SortableContext items={columnTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      {columnTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground">
                          <Icon className="w-8 h-8 mb-2 opacity-30" />
                          <p className="text-xs">No hay tareas</p>
                        </div>
                      ) : (
                        columnTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            employees={employees}
                            users={users}
                            onEdit={() => onEditTask(task)}
                            onDelete={() => onDeleteTask(task.id)}
                          />
                        ))
                    )}
                  </SortableContext>
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              employees={employees}
              users={users}
              onEdit={() => {}}
              onDelete={() => {}}
              isDragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
