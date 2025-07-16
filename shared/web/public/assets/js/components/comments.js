// shared/web/public/assets/js/components/comments.js - Gestor de comentarios para Diario Visual

class CommentsManager {
    constructor() {
        this.modal = document.getElementById('comment-modal');
        this.textarea = document.getElementById('comment-text');
        this.dateLabel = document.getElementById('comment-date');
        this.status = document.getElementById('comment-status');
        this.charCount = document.getElementById('comment-char-count');
        this.deleteBtn = document.getElementById('delete-comment-btn');
        this.saveBtn = document.getElementById('save-comment-btn');
        this.cancelBtns = this.modal.querySelectorAll('.modal-close, .btn-secondary');
        this.commentView = document.getElementById('comment-view');
        this.editBtn = document.getElementById('edit-comment-btn');
        this.inputWrapper = this.modal.querySelector('.comment-input-wrapper');
        this.currentDate = null;
        this.isEditMode = false;

        this.setupEvents();
    }

    setupEvents() {
        // Guardar comentario
        this.saveBtn.addEventListener('click', () => this.saveComment());
        // Eliminar comentario
        this.deleteBtn.addEventListener('click', () => this.deleteComment());
        // Cerrar modal
        this.cancelBtns.forEach(btn => btn.addEventListener('click', () => this.closeModal()));
        // Actualizar contador de caracteres
        this.textarea.addEventListener('input', () => {
            this.charCount.textContent = this.textarea.value.length;
        });
        // Editar comentario
        this.editBtn.addEventListener('click', () => this.setEditMode(true));
    }

    setEditMode(edit) {
        this.isEditMode = edit;
        if (edit) {
            this.inputWrapper.style.display = '';
            this.saveBtn.style.display = '';
            this.deleteBtn.style.display = this.textarea.value ? 'inline-block' : 'none';
            this.commentView.style.display = 'none';
            this.editBtn.style.display = 'none';
            this.textarea.disabled = false;
            this.saveBtn.disabled = false;
            this.textarea.focus();
        } else {
            this.inputWrapper.style.display = 'none';
            this.saveBtn.style.display = 'none';
            this.deleteBtn.style.display = 'none';
            this.commentView.style.display = '';
            this.editBtn.style.display = '';
            this.textarea.disabled = true;
            this.saveBtn.disabled = true;
        }
    }

    async openModal(date) {
        this.currentDate = date;
        this.dateLabel.textContent = date;
        this.textarea.value = '';
        this.charCount.textContent = '0';
        this.status.style.display = 'none';
        this.deleteBtn.style.display = 'none';
        this.modal.style.display = 'flex';
        this.textarea.disabled = false;
        this.saveBtn.disabled = false;
        this.commentView.style.display = 'none';
        this.editBtn.style.display = 'none';
        this.inputWrapper.style.display = '';
        this.saveBtn.style.display = '';
        this.isEditMode = false;

        // Cargar comentario existente
        try {
            const res = await window.photoDiaryCommon.apiRequest(`/comments/${date}`);
            if (res.success && res.data && res.data.comment) {
                this.textarea.value = res.data.comment;
                this.charCount.textContent = res.data.comment.length;
                // Mostrar en modo tarjeta
                this.commentView.innerHTML = `<div class='comment-view-card-content'>${this.escapeHtml(res.data.comment)}</div>`;
                this.commentView.style.display = '';
                this.editBtn.style.display = '';
                this.inputWrapper.style.display = 'none';
                this.saveBtn.style.display = 'none';
                this.deleteBtn.style.display = 'none';
                this.isEditMode = false;
            } else {
                // No hay comentario, modo edición
                this.setEditMode(true);
            }
        } catch (e) {
            // Si es 404 (comentario no encontrado), modo edición
            if (e.message && e.message.includes('404')) {
                this.setEditMode(true);
            } else {
                window.photoDiaryCommon.showNotification('Error al cargar el comentario', 'error');
                this.setEditMode(true);
            }
        }
    }

    closeModal() {
        this.modal.style.display = 'none';
        this.currentDate = null;
        this.isEditMode = false;
    }

    async saveComment() {
        const comment = this.textarea.value;
        if (!this.currentDate) return;
        if (!comment.trim()) {
            window.photoDiaryCommon.showNotification('El comentario no puede estar vacío', 'warning');
            return;
        }
        this.saveBtn.disabled = true;
        this.textarea.disabled = true;
        try {
            await window.photoDiaryCommon.apiRequest(`/comments/${this.currentDate}`, {
                method: 'POST',
                body: JSON.stringify({ comment })
            });
            this.status.style.display = 'block';
            this.status.querySelector('.status-text').textContent = 'Guardado automáticamente';
            this.deleteBtn.style.display = 'inline-block';
            window.photoDiaryCommon.showNotification('Comentario guardado', 'success');
            // Mostrar en modo tarjeta tras guardar
            this.commentView.innerHTML = `<div class='comment-view-card-content'>${this.escapeHtml(comment)}</div>`;
            this.setEditMode(false);
        } catch (e) {
            window.photoDiaryCommon.showNotification('Error al guardar el comentario', 'error');
        } finally {
            this.saveBtn.disabled = false;
            this.textarea.disabled = false;
        }
    }

    async deleteComment() {
        if (!this.currentDate) return;
        if (!confirm('¿Seguro que quieres eliminar el comentario?')) return;
        this.deleteBtn.disabled = true;
        try {
            await window.photoDiaryCommon.apiRequest(`/comments/${this.currentDate}`, {
                method: 'DELETE'
            });
            // Eliminar de la caché para evitar mostrarlo tras eliminar
            if (window.photoDiaryCommon.cache) {
                window.photoDiaryCommon.cache.delete(`/comments/${this.currentDate}:{}`);
                window.photoDiaryCommon.cache.delete(`/comments/${this.currentDate}:{}"`);
                window.photoDiaryCommon.cache.delete(`/comments/${this.currentDate}:undefined`);
            }
            this.textarea.value = '';
            this.charCount.textContent = '0';
            this.deleteBtn.style.display = 'none';
            window.photoDiaryCommon.showNotification('Comentario eliminado', 'success');
            // Forzar recarga si se vuelve a abrir el modal
            this.currentDate = null;
            this.closeModal();
        } catch (e) {
            window.photoDiaryCommon.showNotification('Error al eliminar el comentario', 'error');
        } finally {
            this.deleteBtn.disabled = false;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
    }
}

// Instanciar y exponer globalmente
window.commentsManager = new CommentsManager();

/**
 * USO DESDE feed.js:
 * Cuando el usuario pulse el icono de comentario, llama a:
 *   window.commentsManager.openModal(date)
 * donde date es la fecha de la imagen (formato YYYY-MM-DD)
 */
