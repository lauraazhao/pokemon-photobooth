import { useState } from 'react'
import Camera from './components/Camera'

export default function App() {
  const [photo, setPhoto] = useState<string | null>(null)

  return (
    <main>
      <h1>Card Photobooth</h1>
      {photo ? (
        <div className="result">
          <img src={photo} alt="Your captured photo" />
          <div className="actions">
            <button onClick={() => setPhoto(null)}>Retake</button>
            <a className="button primary" href={photo} download="photobooth.png">
              Download
            </a>
          </div>
        </div>
      ) : (
        <Camera onCapture={setPhoto} />
      )}
    </main>
  )
}
