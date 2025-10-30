import React from 'react'

export default function ParticipantsList({participants}){
  return (
    <div aria-live="polite">
      <h3 className="font-semibold">Participants</h3>
      <ul className="mt-2 space-y-2" role="list">
        {Object.entries(participants).map(([id, info])=> (
          <li key={id} className="flex items-center justify-between" role="listitem">
            <div>
              <div className="font-medium">{info.name ?? id}</div>
              <div className="text-xs text-gray-500">{id}</div>
            </div>
            <div className="text-xs text-gray-400">joined</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
