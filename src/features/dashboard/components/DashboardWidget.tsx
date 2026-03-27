import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@/shared/ui/Icon';
import type { WidgetConfig, WidgetId } from '../hooks/useDashboardLayout';
import './DashboardWidget.css';

interface Props {
  config: WidgetConfig;
  children: ReactNode;
  onReorder: (dragId: WidgetId, dropId: WidgetId) => void;
  onResize: (id: WidgetId, colSpan: 1 | 2) => void;
  onToggleLock: (id: WidgetId) => void;
  /** id of the widget currently being dragged, or null */
  draggingId: WidgetId | null;
  setDraggingId: (id: WidgetId | null) => void;
}

export function DashboardWidget({
  config,
  children,
  onReorder,
  onResize,
  onToggleLock,
  draggingId,
  setDraggingId,
}: Props) {
  const [isOver, setIsOver] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  const isDragging = draggingId === config.id;
  const isDropTarget = isOver && draggingId !== null && draggingId !== config.id;

  // HTML5 DnD
  const handleDragStart = (e: React.DragEvent) => {
    if (config.locked) { e.preventDefault(); return; }
    setDraggingId(config.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', config.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setIsOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (draggingId && draggingId !== config.id) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsOver(true);
    }
  };

  const handleDragLeave = () => setIsOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    if (draggingId && draggingId !== config.id) {
      onReorder(draggingId, config.id);
    }
  };

  const nextColSpan: 1 | 2 = config.colSpan === 1 ? 2 : 1;

  return (
    <div
      ref={dragRef}
      className={[
        'dash-widget',
        isDragging   ? 'dash-widget--dragging'    : '',
        isDropTarget ? 'dash-widget--drop-target' : '',
        config.locked ? 'dash-widget--locked'     : '',
      ].filter(Boolean).join(' ')}
      style={{ gridColumn: `span ${config.colSpan}`, position: 'relative' }}
      draggable={!config.locked}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Control bar — floats ABOVE the widget on hover */}
      <div className="dash-widget__controls">
        {!config.locked && (
          <span className="dash-widget__drag-handle" title="Drag to reorder">
            <Icon name="grip-vertical" size={14} />
          </span>
        )}
        {(config.id !== 'chart' || config.colSpan < 2) && (
          <button
            type="button"
            className="dash-widget__ctrl-btn"
            title={config.colSpan === 1 ? 'Expand to 2 columns' : 'Shrink to 1 column'}
            onClick={() => onResize(config.id, nextColSpan)}
          >
            {config.colSpan === 1 ? '1 → 2 col' : '2 → 1 col'}
          </button>
        )}
        <button
          type="button"
          className={`dash-widget__ctrl-btn${config.locked ? ' dash-widget__ctrl-btn--active' : ''}`}
          onClick={() => onToggleLock(config.id)}
        >
          <Icon name={config.locked ? 'lock' : 'unlock'} size={12} />
          {config.locked ? 'Locked' : 'Lock'}
        </button>
      </div>

      {/* Widget content */}
      <div className="dash-widget__content">
        {children}
      </div>
    </div>
  );
}
