
        const video = document.getElementById('webcam');
        const canvas = document.getElementById('output-canvas');
        const ctx = canvas.getContext('2d');
        const startBtn = document.getElementById('start-camera');
        const loadingText = document.getElementById('loading');
        
        const piano = document.getElementById('piano');
        const pianoScrollWrapper = document.getElementById('piano-scroll-wrapper');
        const drumKit = document.getElementById('drum-kit');
        const guitarKit = document.getElementById('guitar-kit');
        const modeToggle = document.getElementById('mode-toggle');
        
        let detector;
        let currentMode = 'piano'; // 'piano', 'drums', 'guitar'

        // --- UI Setup ---
        function switchMode(mode) {
            currentMode = mode;
            document.querySelectorAll('.mode-toggle button').forEach(b => b.classList.remove('active'));
            document.getElementById(`btn-${mode}`).classList.add('active');
            
            pianoScrollWrapper.style.display = mode === 'piano' ? 'block' : 'none';
            drumKit.style.display = mode === 'drums' ? 'block' : 'none';
            guitarKit.style.display = mode === 'guitar' ? 'block' : 'none';
        }

        document.getElementById('btn-piano').addEventListener('click', () => switchMode('piano'));
        document.getElementById('btn-drums').addEventListener('click', () => switchMode('drums'));
        document.getElementById('btn-guitar').addEventListener('click', () => switchMode('guitar'));

        // --- Piano Generation ---
        const notesData = [];
        notesData.push({ white: 'A0', black: 'Bb0' });
        notesData.push({ white: 'B0', black: null });
        for (let o = 1; o <= 7; o++) {
            notesData.push({ white: `C${o}`, black: `Db${o}` });
            notesData.push({ white: `D${o}`, black: `Eb${o}` });
            notesData.push({ white: `E${o}`, black: null });
            notesData.push({ white: `F${o}`, black: `Gb${o}` });
            notesData.push({ white: `G${o}`, black: `Ab${o}` });
            notesData.push({ white: `A${o}`, black: `Bb${o}` });
            notesData.push({ white: `B${o}`, black: null });
        }
        notesData.push({ white: 'C8', black: null });

        const whiteKeyWidth = 80;
        const allNotes = [];

        notesData.forEach((data, index) => {
            allNotes.push(data.white);
            const whiteKey = document.createElement('div');
            whiteKey.className = 'key white';
            whiteKey.dataset.note = data.white;
            piano.appendChild(whiteKey);
            
            if (data.black) {
                allNotes.push(data.black);
                const blackKey = document.createElement('div');
                blackKey.className = 'key black';
                blackKey.dataset.note = data.black;
                blackKey.style.left = `${(index + 1) * whiteKeyWidth}px`; 
                piano.appendChild(blackKey);
            }
        });

        // --- Guitar Generation ---
        const fretboard = document.getElementById('real-fretboard');
        for(let i=1; i<=12; i++) {
            const fret = document.createElement('div');
            fret.className = 'fret-column';
            fret.dataset.fret = i;
            
            // Fret markers
            if ([3,5,7,9].includes(i)) {
                const marker = document.createElement('div');
                marker.className = 'fret-marker';
                fret.appendChild(marker);
            } else if (i === 12) {
                const m1 = document.createElement('div'); m1.className = 'fret-marker'; m1.style.top = '30%'; fret.appendChild(m1);
                const m2 = document.createElement('div'); m2.className = 'fret-marker'; m2.style.bottom = '30%'; fret.appendChild(m2);
            }
            
            const label = document.createElement('div');
            label.className = 'fret-label';
            label.innerText = i;
            fret.appendChild(label);
            
            fretboard.appendChild(fret);
        }

        // --- Audio Setup ---
        const audioBuffers = {};
        let audioContext;

        async function initAudio() {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            const batchSize = 10;
            for (let i = 0; i < allNotes.length; i += batchSize) {
                const batch = allNotes.slice(i, i + batchSize);
                await Promise.all(batch.map(async (note) => {
                    try {
                        const response = await fetch(`sound/${note}.mp3`);
                        if (response.ok) {
                            const arrayBuffer = await response.arrayBuffer();
                            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                            audioBuffers[note] = audioBuffer;
                        }
                    } catch (e) {
                        console.error(`Failed to load audio for ${note}`, e);
                    }
                }));
            }
        }

        // --- Guitar Synth ---
        const guitarBaseFrequencies = [
            82.41,  // 0: Low E (E2)
            110.00, // 1: A (A2)
            146.83, // 2: D (D3)
            196.00, // 3: G (G3)
            246.94, // 4: B (B3)
            329.63  // 5: High E (E4)
        ];
        
        let frettedStrings = [0, 0, 0, 0, 0, 0]; 

        function playGuitarString(stringIndex, velocity = 80) {
            if (!audioContext) return;
            const time = audioContext.currentTime;
            // Boosted Volume
            const volume = Math.min(Math.max(velocity / 20, 0.5), 2.5);
            
            const fretNumber = frettedStrings[stringIndex];
            // Real Physics Formula: F = Base * 2^(fret/12)
            const frequency = guitarBaseFrequencies[stringIndex] * Math.pow(2, fretNumber / 12);

            const osc = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            const filter = audioContext.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(frequency, time);

            filter.type = 'lowpass';
            // Pluck transient
            filter.frequency.setValueAtTime(frequency * 5, time); 
            filter.frequency.exponentialRampToValueAtTime(frequency, time + 0.4); 

            gainNode.gain.setValueAtTime(volume, time);
            gainNode.gain.exponentialRampToValueAtTime(0.001, time + 2.5); // Guitar sustain

            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioContext.destination);

            osc.start(time);
            osc.stop(time + 3);

            // Visual effect
            const stringEl = document.querySelector(`.guitar-string[data-string="${stringIndex}"]`);
            if (stringEl) {
                stringEl.classList.add('vibrating');
                setTimeout(() => stringEl.classList.remove('vibrating'), 150);
            }
        }

        // --- Drum Synth ---
        function playDrum(type, velocity = 80) {
            if (!audioContext) return;
            const time = audioContext.currentTime;
            // Boosted Volume
            const volume = Math.min(Math.max(velocity / 20, 0.5), 2.5);

            if (type === 'kick') {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(audioContext.destination);
                
                osc.frequency.setValueAtTime(150, time);
                osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
                gain.gain.setValueAtTime(1 * volume, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
                
                osc.start(time);
                osc.stop(time + 0.5);
            } 
            else if (type === 'snare') {
                const osc = audioContext.createOscillator();
                const oscGain = audioContext.createGain();
                osc.type = 'triangle';
                osc.connect(oscGain);
                oscGain.connect(audioContext.destination);
                
                osc.frequency.setValueAtTime(100, time);
                oscGain.gain.setValueAtTime(0.7 * volume, time);
                oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
                osc.start(time);
                osc.stop(time + 0.2);

                const bufferSize = audioContext.sampleRate * 0.2;
                const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
                const noise = audioContext.createBufferSource();
                noise.buffer = buffer;
                
                const filter = audioContext.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.value = 1000;
                
                const noiseGain = audioContext.createGain();
                noiseGain.gain.setValueAtTime(1 * volume, time);
                noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
                
                noise.connect(filter);
                filter.connect(noiseGain);
                noiseGain.connect(audioContext.destination);
                noise.start(time);
            }
            else if (type === 'hihat') {
                const bufferSize = audioContext.sampleRate * 0.1;
                const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
                const noise = audioContext.createBufferSource();
                noise.buffer = buffer;
                
                const filter = audioContext.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.value = 7000;
                
                const noiseGain = audioContext.createGain();
                noiseGain.gain.setValueAtTime(0.5 * volume, time);
                noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
                
                noise.connect(filter);
                filter.connect(noiseGain);
                noiseGain.connect(audioContext.destination);
                noise.start(time);
            }
            else if (type === 'tom1' || type === 'floorTom') {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(audioContext.destination);
                
                const freq = type === 'tom1' ? 150 : 80;
                osc.frequency.setValueAtTime(freq, time);
                osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.4);
                
                gain.gain.setValueAtTime(0.8 * volume, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
                
                osc.start(time);
                osc.stop(time + 0.4);
            }
            else if (type === 'crash') {
                const bufferSize = audioContext.sampleRate * 1.5;
                const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.exp(-3 * i / bufferSize); 
                }
                const noise = audioContext.createBufferSource();
                noise.buffer = buffer;
                
                const filter = audioContext.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.value = 4000;
                
                const noiseGain = audioContext.createGain();
                noiseGain.gain.setValueAtTime(0.8 * volume, time);
                noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 1.5);
                
                noise.connect(filter);
                filter.connect(noiseGain);
                noiseGain.connect(audioContext.destination);
                noise.start(time);
            }
        }

        // --- Piano Audio ---
        function playNote(note, velocity = 80) {
            if (audioContext && audioBuffers[note]) {
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffers[note];
                
                // Boosted Volume
                const volume = Math.min(Math.max(velocity / 20, 0.5), 2.5);
                const gainNode = audioContext.createGain();
                gainNode.gain.value = volume;
                
                source.connect(gainNode);
                gainNode.connect(audioContext.destination);
                source.start(0);
                return { source, gainNode };
            }
            return null;
        }

        function stopNote(noteObj) {
            if (noteObj && noteObj.gainNode && audioContext) {
                const time = audioContext.currentTime;
                noteObj.gainNode.gain.setValueAtTime(noteObj.gainNode.gain.value, time);
                noteObj.gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
                setTimeout(() => {
                    try { noteObj.source.stop(); } catch (e) {}
                }, 100);
            }
        }

        // --- Detection & Collision ---
        async function initDetector() {
            const model = handPoseDetection.SupportedModels.MediaPipeHands;
            const detectorConfig = {
                runtime: 'mediapipe',
                solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
                maxHands: 2
            };
            detector = await handPoseDetection.createDetector(model, detectorConfig);
        }

        function getVideoLayout() {
            const videoRatio = video.videoWidth / video.videoHeight;
            const canvasRatio = canvas.width / canvas.height;
            
            let renderWidth, renderHeight, offsetX, offsetY;
            if (canvasRatio > videoRatio) {
                renderWidth = canvas.width;
                renderHeight = canvas.width / videoRatio;
                offsetX = 0;
                offsetY = (canvas.height - renderHeight) / 2;
            } else {
                renderHeight = canvas.height;
                renderWidth = canvas.height * videoRatio;
                offsetX = (canvas.width - renderWidth) / 2;
                offsetY = 0;
            }
            return { renderWidth, renderHeight, offsetX, offsetY };
        }

        function getDatasetFromPos(x, y, selector, dataKey) {
            const container = document.querySelector(selector);
            if (!container) return null;
            const containerRect = container.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            
            const winX = canvasRect.left + x;
            const winY = canvasRect.top + y;

            if (winY >= containerRect.top && winY <= containerRect.bottom && winX >= containerRect.left && winX <= containerRect.right) {
                // document.elementsFromPoint works perfectly even with CSS rotation!
                const elements = document.elementsFromPoint(winX, winY);
                for (let el of elements) {
                    if (el.dataset[dataKey] !== undefined) return el.dataset[dataKey];
                }
            }
            return null;
        }

        let activeFingers = {}; 
        let previousTipPositions = {}; 
        const fingerTipIndices = [4, 8, 12, 16, 20];
        const PIANO_STRIKE_THRESHOLD = -0.04; 
        const DRUM_STRIKE_THRESHOLD = -0.05;

        async function detectHands() {
            if (detector && video.readyState >= 2) {
                const hands = await detector.estimateHands(video); 
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                const currentFingers = {}; 
                const layout = getVideoLayout();
                
                if (currentMode === 'guitar') {
                    frettedStrings = [0, 0, 0, 0, 0, 0];
                }

                if (hands.length > 0) {
                    hands.forEach((hand, handIndex) => {
                        const mapCoord = (kp) => {
                            const rX = (kp.x / video.videoWidth) * layout.renderWidth + layout.offsetX;
                            return {
                                x: canvas.width - rX,
                                y: (kp.y / video.videoHeight) * layout.renderHeight + layout.offsetY,
                                z: kp.z 
                            };
                        };

                        if (currentMode === 'piano') {
                            fingerTipIndices.forEach((tipIndex) => {
                                const tipRaw = hand.keypoints[tipIndex];
                                const tip = mapCoord(tipRaw);

                                const isStriking = tip.z < PIANO_STRIKE_THRESHOLD;

                                ctx.beginPath();
                                ctx.arc(tip.x, tip.y, 6, 0, 2 * Math.PI);
                                ctx.fillStyle = isStriking ? "#007bff" : "rgba(100,100,100,0.5)"; 
                                ctx.fill();

                                const hoveredTarget = getDatasetFromPos(tip.x, tip.y, '.piano-scroll-wrapper', 'note');
                                const fingerId = `${handIndex}-${tipIndex}`;
                                
                                let velocity = 0;
                                if (previousTipPositions[fingerId]) {
                                    const dx = tip.x - previousTipPositions[fingerId].x;
                                    const dy = tip.y - previousTipPositions[fingerId].y;
                                    velocity = Math.sqrt(dx*dx + dy*dy);
                                }
                                previousTipPositions[fingerId] = { x: tip.x, y: tip.y, z: tip.z };
                                
                                if (hoveredTarget && isStriking) {
                                    currentFingers[fingerId] = hoveredTarget;
                                    if (activeFingers[fingerId]?.note !== hoveredTarget) {
                                        const noteObj = playNote(hoveredTarget, velocity);
                                        activeFingers[fingerId] = { note: hoveredTarget, noteObj: noteObj };
                                        
                                        ctx.beginPath();
                                        ctx.arc(tip.x, tip.y, 12, 0, 2 * Math.PI);
                                        ctx.fillStyle = "#ff4757"; 
                                        ctx.fill();
                                    } else {
                                        activeFingers[fingerId].note = hoveredTarget;
                                    }
                                }
                            });
                        } else if (currentMode === 'drums') {
                            const wrist = mapCoord(hand.keypoints[0]);
                            const index = mapCoord(hand.keypoints[8]);

                            const dx = index.x - wrist.x;
                            const dy = index.y - wrist.y;
                            
                            const tipX = wrist.x + dx * 1.5;
                            const tipY = wrist.y + dy * 1.5;
                            const tipZ = index.z * 1.5;

                            ctx.beginPath();
                            ctx.moveTo(wrist.x, wrist.y);
                            ctx.lineTo(tipX, tipY);
                            ctx.lineWidth = 14;
                            ctx.lineCap = 'round';
                            ctx.strokeStyle = '#d4a373';
                            ctx.stroke();
                            
                            ctx.beginPath();
                            ctx.arc(tipX, tipY, 12, 0, 2 * Math.PI);
                            ctx.fillStyle = '#faedcd'; 
                            ctx.fill();

                            const hoveredTarget = getDatasetFromPos(tipX, tipY, '.drum-kit', 'drum');
                            const stickId = `stick-${handIndex}`;
                            
                            let velocity = 0;
                            if (previousTipPositions[stickId]) {
                                const dxx = tipX - previousTipPositions[stickId].x;
                                const dyy = tipY - previousTipPositions[stickId].y;
                                const dzz = (tipZ - previousTipPositions[stickId].z) * 500; 
                                velocity = Math.sqrt(dxx*dxx + dyy*dyy + dzz*dzz);
                            }
                            previousTipPositions[stickId] = { x: tipX, y: tipY, z: tipZ };
                            
                            const isStriking = tipZ < DRUM_STRIKE_THRESHOLD;

                            if (hoveredTarget && isStriking) {
                                currentFingers[stickId] = hoveredTarget;
                                if (activeFingers[stickId] !== hoveredTarget) {
                                    playDrum(hoveredTarget, velocity);
                                    activeFingers[stickId] = hoveredTarget;
                                    
                                    ctx.beginPath();
                                    ctx.arc(tipX, tipY, 20, 0, 2 * Math.PI);
                                    ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; 
                                    ctx.fill();
                                }
                            }
                        } else if (currentMode === 'guitar') {
                            const wrist = mapCoord(hand.keypoints[0]);
                            
                            // Left Hand: Fretting (Neck is roughly left 60% of screen)
                            if (wrist.x < canvas.width * 0.6) {
                                fingerTipIndices.forEach((tipIndex) => {
                                    const tip = mapCoord(hand.keypoints[tipIndex]);
                                    const isPushing = tip.z < PIANO_STRIKE_THRESHOLD;

                                    if (isPushing) {
                                        // elementsFromPoint respects CSS rotation!
                                        const hoveredString = getDatasetFromPos(tip.x, tip.y, '#strings-container', 'string');
                                        const hoveredFret = getDatasetFromPos(tip.x, tip.y, '#real-fretboard', 'fret');
                                        
                                        if (hoveredString !== null && hoveredFret !== null) {
                                            const sIdx = parseInt(hoveredString);
                                            const fIdx = parseInt(hoveredFret);
                                            // The highest fret held down on this string dominates
                                            if (fIdx > frettedStrings[sIdx]) {
                                                frettedStrings[sIdx] = fIdx;
                                            }
                                        }
                                    }
                                    
                                    ctx.beginPath();
                                    ctx.arc(tip.x, tip.y, 8, 0, 2 * Math.PI);
                                    ctx.fillStyle = isPushing ? "#007bff" : "rgba(100,100,100,0.5)"; 
                                    ctx.fill();
                                });
                                
                            } else {
                                // Right Hand: Strumming
                                const indexTipScreen = mapCoord(hand.keypoints[8]);
                                
                                // Draw Pick
                                ctx.beginPath();
                                ctx.moveTo(indexTipScreen.x, indexTipScreen.y - 10);
                                ctx.lineTo(indexTipScreen.x - 10, indexTipScreen.y + 15);
                                ctx.lineTo(indexTipScreen.x + 10, indexTipScreen.y + 15);
                                ctx.closePath();
                                ctx.fillStyle = '#ff4757'; 
                                ctx.fill();

                                const pickId = `pick-${handIndex}`;
                                let prevY = indexTipScreen.y;
                                let velocity = 80;
                                
                                if (previousTipPositions[pickId]) {
                                    prevY = previousTipPositions[pickId].y;
                                    const dy = indexTipScreen.y - prevY;
                                    velocity = Math.abs(dy); // Y-axis speed = volume
                                }
                                previousTipPositions[pickId] = { x: indexTipScreen.x, y: indexTipScreen.y };

                                // Check String Crossing
                                const strings = document.querySelectorAll('.guitar-string');
                                strings.forEach((strEl) => {
                                    const rect = strEl.getBoundingClientRect();
                                    const canvasRect = canvas.getBoundingClientRect();
                                    const stringY = (rect.top - canvasRect.top) + (rect.height / 2);
                                    
                                    // Did the Y coordinate cross the string line?
                                    if ((prevY < stringY && indexTipScreen.y >= stringY) || (prevY > stringY && indexTipScreen.y <= stringY)) {
                                        const strIndex = parseInt(strEl.dataset.string);
                                        playGuitarString(strIndex, Math.max(velocity * 3, 50)); 
                                    }
                                });
                            }
                        }
                    });
                }
                
                // Cleanup and Dampen off-fingers
                for (let id in activeFingers) {
                    if (!currentFingers[id]) {
                        if (currentMode === 'piano' && activeFingers[id].noteObj) {
                            stopNote(activeFingers[id].noteObj);
                        }
                        delete activeFingers[id];
                    }
                }

                // Visual updates
                if (currentMode === 'piano') {
                    const currentlyPressed = new Set(Object.values(activeFingers).map(f => f.note));
                    document.querySelectorAll('.key').forEach(k => {
                        if (currentlyPressed.has(k.dataset.note)) k.classList.add('active');
                        else k.classList.remove('active');
                    });
                } else if (currentMode === 'drums') {
                    const currentlyPressed = new Set(Object.values(activeFingers));
                    document.querySelectorAll('.drum-pad').forEach(d => {
                        if (currentlyPressed.has(d.dataset.drum)) d.classList.add('active');
                        else d.classList.remove('active');
                    });
                }
            }
            requestAnimationFrame(detectHands);
        }

        startBtn.addEventListener('click', async () => {
            try {
                startBtn.style.display = "none";
                loadingText.style.display = "block";

                await initAudio();
                if (audioContext && audioContext.state === 'suspended') {
                    audioContext.resume();
                }

                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 1280, height: 720 }
                });
                video.srcObject = stream;
                
                await initDetector();
                loadingText.style.display = "none";
                
                // Show UI
                modeToggle.style.display = 'flex';
                switchMode('piano');
                
                setTimeout(() => {
                    pianoScrollWrapper.scrollLeft = (24 * whiteKeyWidth) - (pianoScrollWrapper.clientWidth / 2);
                }, 100);

                video.onloadedmetadata = () => {
                    canvas.width = video.clientWidth;
                    canvas.height = video.clientHeight;
                    window.addEventListener('resize', () => {
                        canvas.width = video.clientWidth;
                        canvas.height = video.clientHeight;
                    });
                    detectHands();
                };
            } catch (error) {
                console.error("Error:", error);
                loadingText.innerText = "Error starting camera or loading model.";
            }
        });
    