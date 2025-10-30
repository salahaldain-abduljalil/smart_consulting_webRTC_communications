<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="csrf-token" content="<?php echo e(csrf_token()); ?>">
    <title>Meeting - {{ $room }}</title>
    @vite(['resources/js/meeting.jsx', 'resources/css/app.css'])
  </head>
  <body class="bg-gray-50">
    <div id="react-meeting" data-room="{{ $room }}"></div>

    <script>
      window.__MEETING_INITIAL_STATE__ = {
        room: @json($room),
        user: @json($user),
      };
    </script>
  </body>
  </html>
