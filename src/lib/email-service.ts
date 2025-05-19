/**
 * Simple email service implementation
 * Provides basic email functionality for subscription notifications
 * This service is used only for subscription-related emails, not for team invitations
 */

import { supabase } from './supabase';

interface EmailOptions {
  to: string;
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
  text?: string;
}

/**
 * Send an email notification
 * 
 * @param options Email options including recipient, subject, and content
 * @returns Promise resolving to success status
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    console.log(`Sending email to ${options.to} with subject "${options.subject}"`);
    
    // In production, integrate with your preferred email service here
    // This could be SendGrid, Amazon SES, Postmark, etc.
    
    if (process.env.NODE_ENV !== 'production') {
      // Log email in development mode
      console.log('Email content:', {
        to: options.to,
        subject: options.subject,
        template: options.template,
        data: options.data,
        html: options.html,
        text: options.text
      });
      
      // Also save to database for development testing
      try {
        await supabase.from('dev_emails').insert({
          recipient: options.to,
          subject: options.subject,
          template: options.template,
          content: options.data || options.html || options.text,
          created_at: new Date().toISOString()
        });
      } catch (dbError) {
        // Silently fail if table doesn't exist - it's just for dev purposes
        console.log('Could not log email to database:', dbError);
      }
    }
    
    // Assume success for now
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}
