<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use App\Models\ConsultationSession;

class SessionScheduled extends Notification
{
    use Queueable;

    public function __construct(public ConsultationSession $session)
    {
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your consultation session is scheduled')
            ->greeting('Hello ' . $notifiable->name)
            ->line('Your consultation has been scheduled.')
            ->line('When: ' . optional($this->session->scheduled_at)->format('Y-m-d H:i'))
            ->action('Open Session', route('client.consultations.show', $this->session->request))
            ->line('Thank you for using our platform!');
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            //
        ];
    }
}
