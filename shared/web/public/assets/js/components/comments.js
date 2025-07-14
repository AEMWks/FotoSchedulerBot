// Componente de comentarios para tarjetas del feed
// Uso: new CommentBox(containerElement, dateString, options)

class CommentBox {
  constructor(container, date, options = {}) {
    this.container = container; // Elemento DOM de la tarjeta
    this.date = date; // Fecha en formato YYYY-MM-DD
    this.options = {
      apiBase: "/api/comments",
      maxLength: 5000,
      ...options,
    };
    this.state = {
      comment: "",
      loading: false,
      saving: false,
      error: null,
      showModal: false,
    };
    this.init();
  }

  init() {
    this.renderIcon();
    this.createModal();
    this.setupEventListeners();
    this.loadComment();
  }

  renderIcon() {
    // Icono 💬, cambia de color si hay comentario
    this.icon = document.createElement("button");
    this.icon.className = "comment-icon";
    this.icon.title = "Ver o editar comentario";
    this.icon.innerHTML = "💬";
    this.container.appendChild(this.icon);
  }

  createModal() {
    // Modal inline para edición
    this.modal = document.createElement("div");
    this.modal.className = "comment-modal";
    this.modal.style.display = "none";
    this.modal.innerHTML = `
      <div class="comment-modal-content">
        <textarea class="comment-textarea" maxlength="${this.options.maxLength}"></textarea>
        <div class="comment-controls">
          <span class="comment-count">0/${this.options.maxLength}</span>
          <button class="comment-save">Guardar</button>
          <button class="comment-delete">Eliminar</button>
          <button class="comment-cancel">Cancelar</button>
        </div>
        <div class="comment-status"></div>
      </div>
    `;
    this.container.appendChild(this.modal);
    // Referencias rápidas
    this.textarea = this.modal.querySelector(".comment-textarea");
    this.count = this.modal.querySelector(".comment-count");
    this.saveBtn = this.modal.querySelector(".comment-save");
    this.deleteBtn = this.modal.querySelector(".comment-delete");
    this.cancelBtn = this.modal.querySelector(".comment-cancel");
    this.status = this.modal.querySelector(".comment-status");
  }

  setupEventListeners() {
    this.icon.addEventListener("click", () => this.showModal());
    this.cancelBtn.addEventListener("click", () => this.hideModal());
    this.saveBtn.addEventListener("click", () => this.saveComment());
    this.deleteBtn.addEventListener("click", () => this.deleteComment());
    this.textarea.addEventListener("input", () => this.updateCount());
    // Cerrar modal al hacer click fuera
    document.addEventListener("mousedown", (e) => {
      if (this.state.showModal && !this.modal.contains(e.target) && e.target !== this.icon) {
        this.hideModal();
      }
    });
  }

  showModal() {
    this.modal.style.display = "block";
    this.state.showModal = true;
    this.textarea.value = this.state.comment;
    this.updateCount();
    this.status.textContent = "";
    this.textarea.focus();
  }

  hideModal() {
    this.modal.style.display = "none";
    this.state.showModal = false;
    this.status.textContent = "";
  }

  updateCount() {
    const len = this.textarea.value.length;
    this.count.textContent = `${len}/${this.options.maxLength}`;
    if (len > 0) {
      this.icon.classList.add("has-comment");
    } else {
      this.icon.classList.remove("has-comment");
    }
  }

  async loadComment() {
    this.state.loading = true;
    this.status.textContent = "Cargando...";
    try {
      const res = await fetch(`${this.options.apiBase}/${this.date}`);
      if (res.ok) {
        const data = await res.json();
        this.state.comment = data.comment || "";
        if (this.state.comment) {
          this.icon.classList.add("has-comment");
        } else {
          this.icon.classList.remove("has-comment");
        }
      } else if (res.status === 404) {
        this.state.comment = "";
        this.icon.classList.remove("has-comment");
      } else {
        throw new Error("Error al cargar comentario");
      }
    } catch (e) {
      this.status.textContent = "Error al cargar comentario";
    } finally {
      this.state.loading = false;
      this.status.textContent = "";
    }
  }

  async saveComment() {
    const comment = this.textarea.value.trim();
    if (comment.length > this.options.maxLength) return;
    this.state.saving = true;
    this.status.textContent = "Guardando...";
    try {
      const res = await fetch(`${this.options.apiBase}/${this.date}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      if (res.ok) {
        this.state.comment = comment;
        this.icon.classList.toggle("has-comment", !!comment);
        this.status.textContent = "¡Guardado!";
        setTimeout(() => this.hideModal(), 700);
      } else {
        throw new Error("Error al guardar");
      }
    } catch (e) {
      this.status.textContent = "Error al guardar";
    } finally {
      this.state.saving = false;
    }
  }

  async deleteComment() {
    if (!confirm("¿Eliminar el comentario?")) return;
    this.status.textContent = "Eliminando...";
    try {
      const res = await fetch(`${this.options.apiBase}/${this.date}`, {
        method: "DELETE",
      });
      if (res.ok) {
        this.state.comment = "";
        this.textarea.value = "";
        this.icon.classList.remove("has-comment");
        this.status.textContent = "Eliminado";
        setTimeout(() => this.hideModal(), 700);
      } else {
        throw new Error("Error al eliminar");
      }
    } catch (e) {
      this.status.textContent = "Error al eliminar";
    }
  }
}

// Exportar para uso global si se requiere
typeof window !== "undefined" && (window.CommentBox = CommentBox);
