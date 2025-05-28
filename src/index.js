import './style.css';

const STORAGE_KEY = 'task-board-state';
const app = document.getElementById('app');

let state = loadState() || {
  columns: [
    { id: 'column-1', title: 'To Do', cards: [] },
    { id: 'column-2', title: 'In Progress', cards: [] },
    { id: 'column-3', title: 'Done', cards: [] },
  ],
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function generateId() {
  return 'card-' + Math.random().toString(36).substr(2, 9);
}

function createElement(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.substring(2).toLowerCase(), value);
    } else if (key === 'className') {
      el.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dkey, dval]) => el.dataset[dkey] = dval);
    } else {
      el.setAttribute(key, value);
    }
  });
  children.forEach(child => {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child) el.appendChild(child);
  });
  return el;
}

function addCard(columnId, text) {
  const column = state.columns.find(c => c.id === columnId);
  if (!column) return;

  // Проверяем, нет ли уже карточки с таким же текстом в колонке, чтобы избежать дубликатов
  if (column.cards.some(card => card.text === text)) {
    alert('Карточка с таким текстом уже существует в этой колонке.');
    return;
  }

  const newCard = { id: generateId(), text };
  column.cards.push(newCard);
  saveState();
  render();
}

function deleteCard(columnId, cardId) {
  const column = state.columns.find(c => c.id === columnId);
  if (!column) return;
  column.cards = column.cards.filter(c => c.id !== cardId);
  saveState();
  render();
}

// Drag and Drop state
let dragData = null;
let placeholder = null;

function onMouseDown(e) {
  if (e.target.closest('.delete-btn')) {
    return;
  }
  
  const card = e.target.closest('.card');
  if (!card) return;

  // Создаём клон карточки для перетаскивания
  const dragCard = card.cloneNode(true);
  dragCard.style.position = 'absolute';
  dragCard.style.zIndex = 1000;
  dragCard.style.width = card.offsetWidth + 'px';
  dragCard.style.pointerEvents = 'none';
  dragCard.classList.add('dragging');

  document.body.appendChild(dragCard);

  dragData = {
        cardId: card.dataset.cardId,
    fromColumnId: card.dataset.columnId,
    originalCard: card,
    dragCard,
    offsetX: e.offsetX,
    offsetY: e.offsetY,
  };

  moveAt(e.pageX, e.pageY);

  function moveAt(pageX, pageY) {
    dragCard.style.left = pageX - dragData.offsetX + 'px';
    dragCard.style.top = pageY - dragData.offsetY + 'px';
  }

  function onMouseMove(event) {
    moveAt(event.pageX, event.pageY);

    const elemBelow = document.elementFromPoint(event.clientX, event.clientY);
    if (!elemBelow) {
      removePlaceholder();
      return;
    }
    const cardContainer = elemBelow.closest('.cards');
    if (!cardContainer) {
      removePlaceholder();
      return;
    }

    const cards = Array.from(cardContainer.children).filter(c => !c.classList.contains('placeholder'));
    let insertBeforeNode = null;
    for (const c of cards) {
      const rect = c.getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) {
        insertBeforeNode = c;
        break;
      }
    }

    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'placeholder';
      placeholder.style.height = dragCard.offsetHeight + 'px';
    }

    if (insertBeforeNode !== placeholder) {
      cardContainer.insertBefore(placeholder, insertBeforeNode);
    }
  }

  function onMouseUp(event) {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    onDragEnd(event);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function onDragEnd() {
  if (!dragData) return;

  // Удаляем клон карточки
  if (dragData.dragCard && dragData.dragCard.parentElement) {
    dragData.dragCard.parentElement.removeChild(dragData.dragCard);
  }

  const fromColumn = state.columns.find(c => c.id === dragData.fromColumnId);
  if (!fromColumn) {
    cleanDrag();
    render();
    return;
  }

  if (!placeholder || !placeholder.parentElement) {
    cleanDrag();
    render();
    return;
  }

  const toColumnEl = placeholder.parentElement.closest('.column');
  if (!toColumnEl) {
    cleanDrag();
    render();
    return;
  }

  const toColumnId = toColumnEl.dataset.columnId;
    const toColumn = state.columns.find(c => c.id === toColumnId);
  if (!toColumn) {
    cleanDrag();
    render();
    return;
  }

  const cardIndex = fromColumn.cards.findIndex(c => c.id === dragData.cardId);
  if (cardIndex === -1) {
    cleanDrag();
    render();
    return;
  }

  const placeholderIndex = Array.from(placeholder.parentElement.children).indexOf(placeholder);

  // Если карточка перемещается в ту же колонку и позиция не меняется — ничего не делаем
  if (fromColumn.id === toColumn.id && cardIndex === placeholderIndex) {
    cleanDrag();
    render();
    return;
  }

  // Проверяем, нет ли дубликата в целевой колонке (по id)
  if (toColumn.cards.some(card => card.id === dragData.cardId)) {
    // Удаляем из исходной колонки, чтобы не было дубликатов
    fromColumn.cards.splice(cardIndex, 1);
    saveState();
    cleanDrag();
    render();
    return;
  }

  // Перемещаем карточку
  const [movedCard] = fromColumn.cards.splice(cardIndex, 1);
  toColumn.cards.splice(placeholderIndex, 0, movedCard);

  saveState();
  cleanDrag();
  render();
}

function cleanDrag() {
  removePlaceholder();
  dragData = null;
}

function removePlaceholder() {
  if (placeholder && placeholder.parentElement) {
    placeholder.parentElement.removeChild(placeholder);
  }
  placeholder = null;
}

function renderCard(card, columnId) {
  const cardEl = createElement('div', {
    className: 'card',
    draggable: false,
    dataset: { cardId: card.id, columnId }
  }, card.text);

  const deleteBtn = createElement('span', { className: 'delete-btn', title: 'Delete card' }, 'x');
  deleteBtn.onclick = e => {
    e.stopPropagation();
    deleteCard(columnId, card.id);
  };
  cardEl.appendChild(deleteBtn);

  cardEl.addEventListener('mousedown', onMouseDown);

  return cardEl;
}

function renderColumn(column) {
  const columnEl = createElement('div', { className: 'column', dataset: { columnId: column.id } });

  const titleEl = createElement('h2', {}, column.title);
  columnEl.appendChild(titleEl);

  const cardsEl = createElement('div', { className: 'cards' });
  column.cards.forEach(card => {
    cardsEl.appendChild(renderCard(card, column.id));
  });
  columnEl.appendChild(cardsEl);

  const addCardBtn = createElement('div', { className: 'add-card' }, '+ Add another card');
  columnEl.appendChild(addCardBtn);

  let addForm = null;

  addCardBtn.onclick = () => {
    if (addForm) return;
    addForm = createAddCardForm(column.id, () => {
      addForm.remove();
      addForm = null;
      addCardBtn.style.display = 'block';
    });
    columnEl.appendChild(addForm);
    addCardBtn.style.display = 'none';
  };

  return columnEl;
}

function createAddCardForm(columnId, onCancel) {
  const form = createElement('div', { className: 'add-card-form' });

  const textarea = createElement('textarea', { placeholder: 'Enter a title for this card...' });
  form.appendChild(textarea);

  const btnAdd = createElement('button', {}, 'Add Card');
  const btnCancel = createElement('button', { className: 'cancel-btn' }, '×');

  const btnsWrapper = createElement('div');
  btnsWrapper.appendChild(btnAdd);
  btnsWrapper.appendChild(btnCancel);
  form.appendChild(btnsWrapper);

  btnAdd.onclick = () => {
    const text = textarea.value.trim();
    if (text) {
      addCard(columnId, text);
      onCancel();
    }
  };

  btnCancel.onclick = () => {
    onCancel();
  };

  textarea.focus();

  return form;
}

function render() {
  app.innerHTML = '';
  state.columns.forEach(column => {
    app.appendChild(renderColumn(column));
  });
}

render();


