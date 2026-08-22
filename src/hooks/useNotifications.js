import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [activeToast, setActiveToast] = useState(null);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(15);
      
      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error("Erro ao carregar notificações:", err);
    }
  }, [userId]);

  const markAllRead = async () => {
    if (!userId) return;
    try {
      const { error } = await supabase.rpc("mark_notifications_read");
      
      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error("Erro ao marcar lidas:", err);
    }
  };

  useEffect(() => {
    if (!userId) return;

    loadNotifications();

    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          loadNotifications();
          setActiveToast({
            title: payload.new.title,
            content: payload.new.content,
          });
          setTimeout(() => {
            setActiveToast(null);
          }, 6000);
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      loadNotifications();
    }, 20000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userId, loadNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    activeToast,
    setActiveToast,
    markAllRead
  };
}
