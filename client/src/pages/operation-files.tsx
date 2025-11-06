import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileUploader } from "@/components/FileUploader";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  FileText,
  Folder,
  MoreVertical,
  Upload,
  FolderPlus,
  Download,
  Trash,
  Edit,
  Image,
  FileArchive,
  FileSpreadsheet,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  List,
  Zap,
  File,
  Clock,
} from "lucide-react";
import type { OperationFile, OperationFolder } from "@shared/schema";
import { format } from "date-fns";

const FILE_CATEGORIES = [
  { value: "payment", label: "Payment", icon: "💰" },
  { value: "expense", label: "Expense", icon: "💸" },
  { value: "image", label: "Image", icon: "🖼️" },
  { value: "document", label: "Document", icon: "📄" },
  { value: "contract", label: "Contract", icon: "📋" },
  { value: "invoice", label: "Invoice", icon: "🧾" },
  { value: "other", label: "Other", icon: "📎" },
];

const FOLDER_COLORS = [
  { value: "blue", label: "Blue", class: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
  { value: "green", label: "Green", class: "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800" },
  { value: "yellow", label: "Yellow", class: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800" },
  { value: "red", label: "Red", class: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" },
  { value: "purple", label: "Purple", class: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800" },
  { value: "gray", label: "Gray", class: "bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800" },
];

function getFileIcon(mimeType: string, category: string | null) {
  if (category === "image" || mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("compressed")) return FileArchive;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("image")) return "Image";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "Spreadsheet";
  if (mimeType.includes("word") || mimeType.includes("document")) return "Document";
  if (mimeType.includes("zip") || mimeType.includes("rar")) return "Archive";
  return "File";
}

export default function OperationFilesPage() {
  const { operationId } = useParams<{ operationId: string }>();
  const { toast } = useToast();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [isFileDialogOpen, setIsFileDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<OperationFolder | null>(null);
  const [editingFile, setEditingFile] = useState<OperationFile | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ b2Key: string; fileHash: string; size: number; originalName: string; mimeType: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<OperationFile | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(0);

  const { data: folders = [] } = useQuery<OperationFolder[]>({
    queryKey: ["/api/operations", operationId, "folders"],
  });

  const { data: files = [] } = useQuery<OperationFile[]>({
    queryKey: ["/api/operations", operationId, "files", selectedFolder],
    queryFn: () => {
      const url = selectedFolder === null 
        ? `/api/operations/${operationId}/files`
        : `/api/operations/${operationId}/files?folderId=${selectedFolder}`;
      return fetch(url).then((res) => res.json());
    },
  });

  const displayFiles = files;
  const previewableFiles = displayFiles.filter(f => 
    f.mimeType.startsWith("image/") || f.mimeType.includes("pdf")
  );

  const createFolderMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const data = {
        name: formData.get("name") as string,
        description: formData.get("description") as string || null,
        category: formData.get("category") as string || null,
        color: formData.get("color") as string || "blue",
      };
      return apiRequest("POST", `/api/operations/${operationId}/folders`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "folders"] });
      setIsFolderDialogOpen(false);
      setEditingFolder(null);
      toast({ title: "Folder created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error creating folder", description: error.message, variant: "destructive" });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) => {
      const data = {
        name: formData.get("name") as string,
        description: formData.get("description") as string || null,
        category: formData.get("category") as string || null,
        color: formData.get("color") as string || "blue",
      };
      return apiRequest("PATCH", `/api/operations/${operationId}/folders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "folders"] });
      setIsFolderDialogOpen(false);
      setEditingFolder(null);
      toast({ title: "Folder updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating folder", description: error.message, variant: "destructive" });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/operations/${operationId}/folders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "folders"] });
      toast({ title: "Folder deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error deleting folder", description: error.message, variant: "destructive" });
    },
  });

  const createFileMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", `/api/operations/${operationId}/files`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "files"] });
      setPendingUpload(null);
      setIsFileDialogOpen(false);
      setIsUploadOpen(false);
      toast({ title: "File uploaded successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error uploading file", description: error.message, variant: "destructive" });
    },
  });

  const updateFileMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) => {
      const data = {
        name: formData.get("name") as string,
        description: formData.get("description") as string || null,
        folderId: formData.get("folderId") as string || null,
        category: formData.get("category") as string || null,
      };
      return apiRequest("PATCH", `/api/operations/${operationId}/files/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "files"] });
      setIsFileDialogOpen(false);
      setEditingFile(null);
      toast({ title: "File updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating file", description: error.message, variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/operations/${operationId}/files/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "files"] });
      toast({ title: "File deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error deleting file", description: error.message, variant: "destructive" });
    },
  });

  const handleUploadComplete = (upload: { b2Key: string; fileHash: string; size: number; originalName: string; mimeType: string }) => {
    setPendingUpload(upload);
    setIsUploadOpen(false);
    setIsFileDialogOpen(true);
  };

  const handleSaveFile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (editingFile) {
      updateFileMutation.mutate({ id: editingFile.id, formData });
    } else if (pendingUpload) {
      const data = {
        ...pendingUpload,
        name: formData.get("name") as string,
        description: formData.get("description") as string || null,
        folderId: formData.get("folderId") as string || null,
        category: formData.get("category") as string || null,
      };
      createFileMutation.mutate(data);
    }
  };

  const handleSaveFolder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (editingFolder) {
      updateFolderMutation.mutate({ id: editingFolder.id, formData });
    } else {
      createFolderMutation.mutate(formData);
    }
  };

  const handlePreview = (file: OperationFile) => {
    if (file.mimeType.startsWith("image/") || file.mimeType.includes("pdf")) {
      const index = previewableFiles.findIndex(f => f.id === file.id);
      setPreviewIndex(index);
      setPreviewFile(file);
    }
  };

  const nextPreview = () => {
    if (previewIndex < previewableFiles.length - 1) {
      const nextFile = previewableFiles[previewIndex + 1];
      setPreviewFile(nextFile);
      setPreviewIndex(previewIndex + 1);
    }
  };

  const prevPreview = () => {
    if (previewIndex > 0) {
      const prevFile = previewableFiles[previewIndex - 1];
      setPreviewFile(prevFile);
      setPreviewIndex(previewIndex - 1);
    }
  };

  const currentFolder = folders.find(f => f.id === selectedFolder);
  const folderColorClass = currentFolder 
    ? FOLDER_COLORS.find(c => c.value === currentFolder.color)?.class 
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Operation Files</h1>
            <p className="text-muted-foreground mt-1">
              {displayFiles.length} file{displayFiles.length !== 1 ? 's' : ''} 
              {selectedFolder && ` in ${currentFolder?.name}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              data-testid="button-toggle-view"
            >
              {viewMode === "grid" ? <List className="w-4 h-4" /> : <Grid3x3 className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsFolderDialogOpen(true)}
              data-testid="button-new-folder"
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              New Folder
            </Button>
            <Button
              onClick={() => setIsUploadOpen(true)}
              data-testid="button-upload-file"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload File
            </Button>
          </div>
        </div>

        {/* Folders Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Button
            variant={selectedFolder === null ? "default" : "outline"}
            onClick={() => setSelectedFolder(null)}
            className="shrink-0"
            data-testid="button-all-files"
          >
            <Folder className="w-4 h-4 mr-2" />
            All Files
          </Button>
          {folders.map((folder) => {
            const colorClass = FOLDER_COLORS.find(c => c.value === folder.color)?.class || "";
            return (
              <div key={folder.id} className="relative shrink-0 group">
                <Button
                  variant={selectedFolder === folder.id ? "default" : "outline"}
                  onClick={() => setSelectedFolder(folder.id)}
                  className={selectedFolder === folder.id ? "" : colorClass}
                  data-testid={`button-folder-${folder.id}`}
                >
                  <Folder className="w-4 h-4 mr-2" />
                  {folder.name}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute -top-1 -right-1 w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`folder-menu-${folder.id}`}
                    >
                      <MoreVertical className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => {
                      setEditingFolder(folder);
                      setIsFolderDialogOpen(true);
                    }}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (confirm(`Delete folder "${folder.name}"? This will delete all files inside.`)) {
                          deleteFolderMutation.mutate(folder.id);
                        }
                      }}
                      className="text-destructive"
                    >
                      <Trash className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>

        {/* Files Display */}
        {displayFiles.length === 0 ? (
          <Card className="p-12 text-center">
            <Folder className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <h3 className="text-lg font-semibold mb-2">No files yet</h3>
            <p className="text-muted-foreground mb-4">
              Upload your first file to get started
            </p>
            <Button onClick={() => setIsUploadOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload File
            </Button>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayFiles.map((file) => {
              const FileIcon = getFileIcon(file.mimeType, file.category);
              const category = FILE_CATEGORIES.find(c => c.value === file.category);
              const isImage = file.mimeType.startsWith("image/");
              const isAutomated = file.uploadedVia === "gmail_automation" || !!file.sourceGmailAttachmentId;

              return (
                <Card
                  key={file.id}
                  className="group overflow-hidden hover:shadow-lg transition-all cursor-pointer border-2"
                  onClick={() => handlePreview(file)}
                  data-testid={`file-card-${file.id}`}
                >
                  {/* Thumbnail/Preview */}
                  <div className="relative h-48 bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center overflow-hidden">
                    {isImage ? (
                      <img
                        src={`/api/operations/${operationId}/files/${file.id}/download`}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <FileIcon className="w-20 h-20 text-muted-foreground/40" />
                    )}
                    
                    {/* Automated Badge */}
                    {isAutomated && (
                      <Badge className="absolute top-2 left-2 bg-primary/90 text-primary-foreground border-0">
                        <Zap className="w-3 h-3 mr-1" />
                        Automated
                      </Badge>
                    )}

                    {/* Actions Menu */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="secondary" size="icon" className="shadow-lg" data-testid={`file-menu-${file.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/api/operations/${operationId}/files/${file.id}/download`, "_blank");
                            }}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFile(file);
                              setIsFileDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete "${file.name}"?`)) {
                                deleteFileMutation.mutate(file.id);
                              }
                            }}
                            className="text-destructive"
                          >
                            <Trash className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* File Type Badge */}
                    <Badge variant="secondary" className="absolute bottom-2 left-2 text-xs">
                      {getFileTypeLabel(file.mimeType)}
                    </Badge>
                  </div>

                  {/* File Info */}
                  <div className="p-4">
                    <h3 className="font-medium truncate mb-1" title={file.name}>
                      {file.name}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>{formatFileSize(file.size)}</span>
                      <span>{format(new Date(file.createdAt), "MMM d, yyyy")}</span>
                    </div>
                    {category && (
                      <Badge variant="outline" className="text-xs">
                        {category.icon} {category.label}
                      </Badge>
                    )}
                    {file.description && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {file.description}
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <div className="divide-y">
              {displayFiles.map((file) => {
                const FileIcon = getFileIcon(file.mimeType, file.category);
                const category = FILE_CATEGORIES.find(c => c.value === file.category);
                const isAutomated = file.uploadedVia === "gmail_automation" || !!file.sourceGmailAttachmentId;

                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => handlePreview(file)}
                    data-testid={`file-row-${file.id}`}
                  >
                    {/* Icon/Thumbnail */}
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {file.mimeType.startsWith("image/") ? (
                        <img
                          src={`/api/operations/${operationId}/files/${file.id}/download`}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileIcon className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{file.name}</h3>
                        {isAutomated && (
                          <Badge variant="secondary" className="shrink-0">
                            <Zap className="w-3 h-3 mr-1" />
                            Automated
                          </Badge>
                        )}
                        {category && (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {category.icon} {category.label}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>{getFileTypeLabel(file.mimeType)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(file.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/api/operations/${operationId}/files/${file.id}/download`, "_blank");
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFile(file);
                              setIsFileDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete "${file.name}"?`)) {
                                deleteFileMutation.mutate(file.id);
                              }
                            }}
                            className="text-destructive"
                          >
                            <Trash className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Upload Dialog */}
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload File</DialogTitle>
              <DialogDescription>Upload a file to this operation</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <FileUploader
                operationId={operationId!}
                onUploadComplete={handleUploadComplete}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* File Metadata Dialog */}
        <Dialog open={isFileDialogOpen} onOpenChange={(open) => {
          setIsFileDialogOpen(open);
          if (!open) {
            setEditingFile(null);
            setPendingUpload(null);
          }
        }}>
          <DialogContent>
            <form onSubmit={handleSaveFile}>
              <DialogHeader>
                <DialogTitle>{editingFile ? "Edit File" : "File Details"}</DialogTitle>
                <DialogDescription>
                  {editingFile ? "Update file information" : "Add details for your file"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingFile?.name || pendingUpload?.originalName}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={editingFile?.description || ""}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="folderId">Folder</Label>
                  <select
                    id="folderId"
                    name="folderId"
                    defaultValue={editingFile?.folderId || selectedFolder || ""}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  >
                    <option value="">Root (No folder)</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    name="category"
                    defaultValue={editingFile?.category || ""}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  >
                    <option value="">Select category</option>
                    {FILE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsFileDialogOpen(false);
                    setEditingFile(null);
                    setPendingUpload(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createFileMutation.isPending || updateFileMutation.isPending}>
                  {editingFile ? "Update" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Folder Dialog */}
        <Dialog open={isFolderDialogOpen} onOpenChange={(open) => {
          setIsFolderDialogOpen(open);
          if (!open) setEditingFolder(null);
        }}>
          <DialogContent>
            <form onSubmit={handleSaveFolder}>
              <DialogHeader>
                <DialogTitle>{editingFolder ? "Edit Folder" : "New Folder"}</DialogTitle>
                <DialogDescription>
                  {editingFolder ? "Update folder details" : "Create a new folder for organizing files"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingFolder?.name}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={editingFolder?.description || ""}
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    name="category"
                    defaultValue={editingFolder?.category || ""}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  >
                    <option value="">Select category</option>
                    {FILE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="color">Color</Label>
                  <select
                    id="color"
                    name="color"
                    defaultValue={editingFolder?.color || "blue"}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  >
                    {FOLDER_COLORS.map((color) => (
                      <option key={color.value} value={color.value}>
                        {color.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsFolderDialogOpen(false);
                    setEditingFolder(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createFolderMutation.isPending || updateFolderMutation.isPending}>
                  {editingFolder ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
          <DialogContent className="max-w-5xl h-[90vh]">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="truncate pr-4">{previewFile?.name}</DialogTitle>
                <div className="flex items-center gap-2 shrink-0">
                  {previewableFiles.length > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={prevPreview}
                        disabled={previewIndex === 0}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground px-2">
                        {previewIndex + 1} / {previewableFiles.length}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={nextPreview}
                        disabled={previewIndex === previewableFiles.length - 1}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(`/api/operations/${operationId}/files/${previewFile?.id}/download`, "_blank")}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setPreviewFile(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-hidden rounded-lg bg-muted/30 flex items-center justify-center">
              {previewFile?.mimeType.startsWith("image/") ? (
                <img
                  src={`/api/operations/${operationId}/files/${previewFile.id}/download`}
                  alt={previewFile.name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : previewFile?.mimeType.includes("pdf") ? (
                <iframe
                  src={`/api/operations/${operationId}/files/${previewFile.id}/download`}
                  className="w-full h-full"
                  title={previewFile.name}
                />
              ) : (
                <div className="text-center p-8">
                  <Eye className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground">Preview not available</p>
                  <Button
                    className="mt-4"
                    onClick={() => window.open(`/api/operations/${operationId}/files/${previewFile?.id}/download`, "_blank")}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download to View
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
