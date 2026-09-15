import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { notificationService } from '../../services/api';
import { NotificationItem } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import {
  Bell,
  CheckCircle2,
  CheckCheck,
  ArrowLeft,
  Clock,
  Inbox,
  AlertCircle,
  RefreshCw,
  LifeBuoy,
  MessageSquare,
} from 'lucide-react';

export const StudentNotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [markingAll, setMarkingAll] = useState<boolean>(false);

  const navigate = useNavigate();
  const { success, error } = useToast();

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationService.getMyNotifications();
      if (res.data.success) {
        setNotifications(res.data.data.notifications || []);
        setUnreadCount(res.data.data.unreadCount || 0);
      }
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        setNotifications((prev) =>
          prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        await notificationService.markAsRead(item._id);
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }

    if (item.type === 'COMPLAINT_REPLY' || item.type === 'COMPLAINT_STATUS' || item.relatedTicketId) {
      navigate('/student/tickets', {
        state: { ticketId: item.relatedTicketId },
      });
    }
  };

  const handleMarkAsRead = async (id: string, currentlyRead: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentlyRead) return;

    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      await notificationService.markAsRead(id);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;

    try {
      setMarkingAll(true);
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);

      await notificationService.markAllAsRead();
      success('All notifications marked as read');
    } catch (err: any) {
      error('Failed to mark all as read');
      fetchNotifications();
    } finally {
      setMarkingAll(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    return true;
  });

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6 font-sans max-w-xl mx-auto pb-8">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/student/dashboard"
            className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-200 transition shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-black rounded-full bg-rose-500 text-white shadow-sm shadow-rose-500/30">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">Library notices and updates history</p>
          </div>
        </div>

        {/* Mark All Read Button */}
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 transition border border-indigo-200/50 dark:border-indigo-800/50 disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'unread'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <button
          onClick={fetchNotifications}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Refresh notifications"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>

      {/* Loading State */}
      {loading && notifications.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 animate-pulse space-y-3"
            >
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
              <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-5/6" />
              <div className="h-3 bg-slate-100 dark:bg-slate-800/40 rounded w-1/4" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredNotifications.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            {filter === 'unread' ? 'No Unread Notifications' : 'No Notifications Yet'}
          </h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            {filter === 'unread'
              ? "You're completely caught up with all library announcements."
              : 'Important announcements and updates from the library administrator will appear here.'}
          </p>
          {filter === 'unread' && notifications.length > 0 && (
            <button
              onClick={() => setFilter('all')}
              className="text-xs font-bold text-indigo-600 hover:underline pt-1 inline-block"
            >
              View all notification history
            </button>
          )}
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.map((item) => {
          const isUnread = !item.isRead;
          const isComplaintUpdate =
            item.type === 'COMPLAINT_REPLY' ||
            item.type === 'COMPLAINT_STATUS' ||
            Boolean(item.relatedTicketId);

          return (
            <div
              key={item._id}
              onClick={() => handleNotificationClick(item)}
              className={`relative bg-white dark:bg-slate-900 rounded-2xl p-5 border transition-all cursor-pointer shadow-sm hover:translate-y-[-1px] ${
                isUnread
                  ? 'border-indigo-300 dark:border-indigo-700/60 ring-1 ring-indigo-500/10 shadow-indigo-500/5 hover:border-indigo-400'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Icon Container */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    isUnread
                      ? isComplaintUpdate
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                        : 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {isComplaintUpdate ? (
                    <MessageSquare className="w-4 h-4" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-sm font-bold truncate ${
                          isUnread
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {item.title}
                      </h3>
                      {isComplaintUpdate && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          Complaint
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider ${
                        isUnread
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {isUnread ? 'Unread' : 'Read'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-words whitespace-pre-wrap">
                    {item.message || item.description}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <Clock className="w-3 h-3" />
                      {formatDate(item.createdAt)}
                    </span>

                    <div className="flex items-center gap-3">
                      {isComplaintUpdate && (
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold text-[10px] hover:underline">
                          View Conversation &rarr;
                        </span>
                      )}
                      {isUnread && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(item._id, item.isRead, e)}
                          className="text-slate-400 hover:text-indigo-600 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
