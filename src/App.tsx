import { useEffect, useMemo, useRef, useState } from 'react';
import { bonusLink, channelUrl, codeWord, floors, type Floor } from './data/floors';

type Screen = 'gate' | 'home' | 'floor' | 'code';

function App() {
  const [screen, setScreen] = useState<Screen>('gate');
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [doorsClosed, setDoorsClosed] = useState(false);
  const [word, setWord] = useState('');
  const [wordAccepted, setWordAccepted] = useState(false);
  const [wordError, setWordError] = useState('');
  const [activeButton, setActiveButton] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(
      'https://actions.google.com/sounds/v1/impacts/mechanical_switch.ogg',
    );
    audioRef.current.preload = 'auto';
  }, []);

  const title = useMemo(() => {
    if (screen === 'floor' && selectedFloor) return `ЭТАЖ ${selectedFloor.id}`;
    if (screen === 'code') return 'КОДОВОЕ СЛОВО';
    if (screen === 'home') return 'ВЫБЕРИТЕ ЭТАЖ';
    return 'ПРОВЕРКА ДОСТУПА';
  }, [screen, selectedFloor]);

  const playButtonFeedback = () => {
    try {
      navigator.vibrate?.(35);
    } catch {}

    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        void audioRef.current.play();
      }
    } catch {}
  };

  const withDoorTransition = (action: () => void, delay = 650) => {
    setDoorsClosed(true);
    window.setTimeout(() => {
      action();
      setDoorsClosed(false);
    }, delay);
  };

  const handleFakeSubscriptionCheck = () => {
    playButtonFeedback();
    setActiveButton('check');
    window.setTimeout(() => {
      setActiveButton(null);
      setSubscribed(true);
      withDoorTransition(() => setScreen('home'));
    }, 220);
  };

  const openFloor = (floor: Floor) => {
    playButtonFeedback();
    setActiveButton(`floor-${floor.id}`);
    window.setTimeout(() => {
      setActiveButton(null);
      withDoorTransition(() => {
        setSelectedFloor(floor);
        setScreen('floor');
      }, 700);
    }, 250);
  };

  const goHome = () => {
    playButtonFeedback();
    setActiveButton('back');
    window.setTimeout(() => {
      setActiveButton(null);
      withDoorTransition(() => {
        setSelectedFloor(null);
        setScreen('home');
        setWord('');
        setWordAccepted(false);
        setWordError('');
      });
    }, 180);
  };

  const openCodeScreen = () => {
    playButtonFeedback();
    setActiveButton('code');
    window.setTimeout(() => {
      setActiveButton(null);
      withDoorTransition(() => {
        setWord('');
        setWordAccepted(false);
        setWordError('');
        setScreen('code');
      }, 700);
    }, 250);
  };

  const checkWord = () => {
    playButtonFeedback();
    setActiveButton('check-word');

    window.setTimeout(() => {
      setActiveButton(null);

      if (word.trim().toLowerCase() === codeWord.toLowerCase()) {
        setWordAccepted(true);
        setWordError('');
        return;
      }

      setWordAccepted(false);
      setWordError('Лифт не распознал команду. Попробуйте ещё раз.');
    }, 180);
  };

  // ✅ индикатор использует уже существующее состояние
  const isIndicatorActive = (id: number) => {
    return selectedFloor?.id === id || activeButton === `floor-${id}`;
  };

  return (
    <div className="app-shell">
      <div className="elevator-frame">
        <header className="display-panel">
          <div className="brand">idst — Музыка для лифта</div>

          <div className={`display ${screen === 'home' ? 'display-blink' : ''}`}>
            {title}
          </div>

          {/* 🔥 НОВЫЙ ИНДИКАТОР */}
          <div className="floor-indicator">
            {[1, 2, 3, 4, 5].map((id) => (
              <span
                key={id}
                className={`floor-indicator-item ${isIndicatorActive(id) ? 'active' : ''}`}
              >
                {id}
              </span>
            ))}
          </div>
        </header>

        <main className="elevator-stage">
          <div className={`doors ${doorsClosed ? 'closed' : 'open'}`} aria-hidden="true">
            <div className="door left" />
            <div className="door right" />
          </div>

          <section className="screen-content">
            {screen === 'gate' && (
              <div className="screen-block center-block">
                <p className="lead">
                  Чтобы подняться выше, подпишитесь на канал группы idst.
                </p>

                <div className="stack gap-md">
                  <a className="wide-button secondary" href={channelUrl} target="_blank" rel="noreferrer">
                    Подписаться на канал
                  </a>

                  <button
                    className={`wide-button ${activeButton === 'check' ? 'is-pressed' : ''}`}
                    onClick={handleFakeSubscriptionCheck}
                  >
                    Проверить подписку
                  </button>
                </div>

                <p className="hint">
                  Сейчас это демо-версия: кнопка проверки ведёт дальше без реальной проверки.
                </p>
              </div>
            )}

            {screen === 'home' && (
              <div className="screen-block home-screen">
                <div className="elevator-panel">
                  <div className="panel-display panel-display-blink">ВЫБЕРИТЕ ЭТАЖ</div>

                  <div className="panel-buttons">
                    {floors.map((floor) => (
                      <button
                        key={floor.id}
                        className={`elevator-btn ${activeButton === `floor-${floor.id}` ? 'is-pressed' : ''}`}
                        onClick={() => openFloor(floor)}
                      >
                        {floor.id}
                      </button>
                    ))}

                    <a
                      className="elevator-btn music-btn"
                      href="https://music.yandex.ru/artist/6380387"
                      target="_blank"
                      rel="noreferrer"
                      onClick={playButtonFeedback}
                    >
                      idst
                    </a>
                  </div>

                  <button
                    className={`code-elevator-btn ${activeButton === 'code' ? 'is-pressed' : ''}`}
                    onClick={openCodeScreen}
                  >
                    КОДОВОЕ СЛОВО
                  </button>
                </div>

                <p className="hint home-hint">
                  Пассажиры, не осуществившие выбор, будут автоматически доставлены на последний этаж.
                </p>
              </div>
            )}

            {screen === 'floor' && selectedFloor && (
              <div className="screen-block floor-screen">
                <div className="floor-card">
                  <img src={selectedFloor.image} alt={selectedFloor.title} className="floor-image" />

                  <div className="floor-copy">
                    <div className="floor-badge">Этаж {selectedFloor.id}</div>
                    <h1>{selectedFloor.title}</h1>
                    <p>{selectedFloor.description}</p>

                    <div className="floor-actions">
                      <a className="wide-button" href={selectedFloor.musicUrl} target="_blank" rel="noreferrer">
                        Слушать на Яндекс Музыке
                      </a>

                      <button
                        className={`wide-button secondary ${activeButton === 'back' ? 'is-pressed' : ''}`}
                        onClick={goHome}
                      >
                        Назад
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {screen === 'code' && (
              <div className="screen-block center-block code-screen">
                <p className="lead">
                  Введите кодовое слово, чтобы открыть бонус-трек.
                </p>

                <label className="code-input-wrap">
                  <span>Кодовое слово</span>

                  <input
                    value={word}
                    onChange={(e) => setWord(e.target.value)}
                    placeholder="Введите слово"
                    className="code-input"
                  />
                </label>

                <div className="stack gap-md">
                  <button
                    className={`wide-button ${activeButton === 'check-word' ? 'is-pressed' : ''}`}
                    onClick={checkWord}
                  >
                    Проверить
                  </button>

                  <button
                    className={`wide-button secondary ${activeButton === 'back' ? 'is-pressed' : ''}`}
                    onClick={goHome}
                  >
                    Назад
                  </button>
                </div>

                {wordAccepted && (
                  <div className="result-box success">
                    <p>Код принят. Допуск открыт.</p>

                    <a className="wide-button" href={bonusLink} target="_blank" rel="noreferrer">
                      Получить бонус-трек
                    </a>
                  </div>
                )}

                {!wordAccepted && wordError && (
                  <div className="result-box error">
                    {wordError}
                  </div>
                )}
              </div>
            )}
          </section>
        </main>

        <footer className="footer-bar">
          <span>demo mode</span>
          <span>{subscribed ? 'доступ открыт' : 'ожидание проверки'}</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
