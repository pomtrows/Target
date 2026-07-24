import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, Loader2, Download, Trash2, FileImage, FileText, FileAudio, FileVideo } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTarget } from '../../contexts/TargetContext';
import Modal from '../Shared/Modal';

export default function AttachmentManager({ isOpen, onClose, objective, onUpdate }) {
  const { dispatch } = useTarget();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const attachments = objective?.attachments || [];

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;
    
    setUploading(true);
    setError(null);
    
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const user = userData.user;

      const newAttachments = [];

      for (const file of acceptedFiles) {
        // Clean filename and create unique path
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `${user.id}/${objective.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);

        newAttachments.push({
          id: fileName,
          name: file.name,
          size: file.size,
          type: file.type,
          path: filePath,
          url: publicUrl,
          created_at: new Date().toISOString()
        });
      }

      // Update objective
      const updatedObjective = {
        ...objective,
        attachments: [...attachments, ...newAttachments]
      };

      if (onUpdate) {
        onUpdate({ attachments: [...attachments, ...newAttachments] });
      } else {
        dispatch({
          type: 'UPDATE_OBJECTIVE',
          payload: updatedObjective
        });
      }

    } catch (err) {
      console.error('Upload error:', err);
      setError("Erreur lors de l'envoi du fichier.");
    } finally {
      setUploading(false);
    }
  }, [objective, attachments, dispatch, onUpdate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleDelete = async (attachmentToDelete) => {
    try {
      // Remove from storage
      await supabase.storage
        .from('attachments')
        .remove([attachmentToDelete.path]);

      // Update objective
      const updatedAttachments = attachments.filter(a => a.id !== attachmentToDelete.id);
      
      if (onUpdate) {
        onUpdate({ attachments: updatedAttachments });
      } else {
        dispatch({
          type: 'UPDATE_OBJECTIVE',
          payload: {
            ...objective,
            attachments: updatedAttachments
          }
        });
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert("Impossible de supprimer la pièce jointe.");
    }
  };

  const getFileIcon = (type) => {
    if (!type) return <FileIcon size={24} />;
    if (type.startsWith('image/')) return <FileImage size={24} className="text-accent-cyan" />;
    if (type.startsWith('video/')) return <FileVideo size={24} className="text-accent-gold" />;
    if (type.startsWith('audio/')) return <FileAudio size={24} className="text-accent-violet" />;
    if (type.includes('pdf') || type.includes('document') || type.includes('text/')) return <FileText size={24} className="text-dark-300" />;
    return <FileIcon size={24} className="text-dark-400" />;
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pièces jointes"
      maxWidth="max-w-2xl"
    >
      <div className="w-full flex flex-col">
        
        {/* Upload Area */}
        <div 
          {...getRootProps()} 
          style={{ marginTop: '-10px', marginBottom: '20px' }}
          className={`border-2 border-dashed rounded-2xl px-4 pt-4 pb-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
            isDragActive 
              ? 'border-accent-cyan bg-accent-cyan/10' 
              : 'border-dark-600/50 bg-dark-800/50 hover:bg-dark-800 hover:border-dark-500'
          }`}
        >
          <input {...getInputProps()} />
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-dark-700 rounded-full flex items-center justify-center text-dark-300">
            {uploading ? (
              <Loader2 size={24} className="animate-spin text-accent-cyan sm:w-8 sm:h-8" />
            ) : (
              <UploadCloud size={24} className={`sm:w-8 sm:h-8 ${isDragActive ? 'text-accent-cyan' : ''}`} />
            )}
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-dark-200 text-center mt-2 sm:mt-3 leading-tight">
            {uploading ? 'Envoi en cours...' : isDragActive ? 'Déposez les fichiers ici' : 'Cliquez ou glissez-déposez des fichiers'}
          </h3>
          <div className="h-8 sm:h-12"></div>
          {error && <p className="text-accent-red mt-3 text-sm bg-accent-red/10 p-2 rounded-lg">{error}</p>}
        </div>

        {/* Attachments List */}
        {attachments.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-2">
              Fichiers attachés ({attachments.length})
            </h4>
            <div className="grid gap-3">
              {attachments.map((file) => (
                <div 
                  key={file.id}
                  className="flex items-center gap-3 bg-dark-800 border border-dark-600/30 p-3 rounded-xl hover:border-dark-500 transition-colors group w-full overflow-hidden"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-dark-700/50 rounded-lg flex items-center justify-center flex-shrink-0">
                    {getFileIcon(file.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-xs text-dark-100 font-medium truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-dark-400 text-[10px] sm:text-xs mt-0.5 truncate">
                      {formatSize(file.size)} • {new Date(file.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-5 flex-shrink-0">
                    <a 
                      href={file.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1.5 sm:p-2 text-dark-400 hover:text-accent-cyan hover:bg-dark-700 rounded-lg transition-colors"
                      title="Télécharger"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download size={18} />
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Voulez-vous vraiment supprimer "${file.name}" ?`)) {
                          handleDelete(file);
                        }
                      }}
                      className="p-2 text-dark-400 hover:text-accent-red hover:bg-dark-700 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
      </div>
    </Modal>
  );
}
