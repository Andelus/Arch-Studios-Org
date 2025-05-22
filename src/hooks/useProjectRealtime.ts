import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { 
  Project, 
  Task, 
  ProjectMember,
  DatabaseProject,
  DatabaseTask,
  DatabaseProjectMember
} from '@/types/workspace';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseProjectRealtimeProps {
  projectId: string | undefined;
  userId: string | undefined;
  onProjectUpdate: (project: Partial<Project>) => void;
  onTasksUpdate: (tasks: Task[]) => void;
  onMembersUpdate: (members: ProjectMember[]) => void;
}

export function useProjectRealtime({
  projectId,
  userId,
  onProjectUpdate,
  onTasksUpdate,
  onMembersUpdate
}: UseProjectRealtimeProps) {
  useEffect(() => {
    if (!projectId || !userId) return;

    const channels: RealtimeChannel[] = [];

    // Project updates
    const projectChannel = (supabase
      .channel(`project-${projectId}`) as any)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`
        },
        (payload: { new: DatabaseProject }) => {
          const updatedData = payload.new;
          onProjectUpdate({
            name: updatedData.name,
            description: updatedData.description,
            status: updatedData.status,
            lastUpdated: updatedData.updated_at,
            progress: updatedData.progress,
            isFolder: updatedData.is_folder,
            isTemplate: updatedData.is_template,
            parentId: updatedData.parent_id,
            organization_id: updatedData.organization_id
          });
        }
      )
      .subscribe();
    channels.push(projectChannel);

    // Task updates
    const taskChannel = (supabase
      .channel(`tasks-${projectId}`) as any)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`
        },
        async () => {
          // Fetch all tasks for the project
          const { data } = await supabase
            .from('tasks')
            .select(`
              *,
              profiles(
                email,
                display_name,
                avatar_url
              )
            `)
            .eq('project_id', projectId);

          if (data) {
            const formattedTasks: Task[] = data.map(task => ({
              id: task.id,
              title: task.title,
              description: task.description,
              status: task.status,
              assignee: task.profiles?.display_name,
              dueDate: task.due_date,
              priority: task.priority,
              projectId: task.project_id
            }));

            onTasksUpdate(formattedTasks);
          }
        }
      )
      .subscribe();
    channels.push(taskChannel);

    // Team member updates
    const memberChannel = (supabase
      .channel(`members-${projectId}`) as any)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_members',
          filter: `project_id=eq.${projectId}`
        },
        async () => {
          const { data } = await supabase
            .from('project_members')
            .select(`
              *,
              profiles(
                email,
                display_name,
                avatar_url
              )
            `)
            .eq('project_id', projectId);

          if (data) {
            const members: ProjectMember[] = data.map(member => ({
              id: member.user_id,
              name: member.profiles?.display_name || 'Unknown',
              avatar: member.profiles?.avatar_url || '/avatars/default.jpg',
              role: member.role,
              status: member.status,
              permission: member.permission
            }));

            onMembersUpdate(members);
          }
        }
      )
      .subscribe();
    channels.push(memberChannel);

    // Cleanup subscriptions
    return () => {
      channels.forEach(channel => channel.unsubscribe());
    };
  }, [projectId, userId, onProjectUpdate, onTasksUpdate, onMembersUpdate]);
}