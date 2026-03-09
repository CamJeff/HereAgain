const phrases = [
  'Proud Canadian',
  'Physics student',
  'Really cool guy'
];

const typedText = document.querySelector('.typed-text');

if (typedText) {
  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;

  const typeLoop = () => {
    const currentPhrase = phrases[phraseIndex];

    if (!isDeleting) {
      charIndex += 1;
      typedText.textContent = currentPhrase.slice(0, charIndex);

      if (charIndex === currentPhrase.length) {
        isDeleting = true;
        setTimeout(typeLoop, 1300);
        return;
      }

      setTimeout(typeLoop, 95);
      return;
    }

    charIndex -= 1;
    typedText.textContent = currentPhrase.slice(0, charIndex);

    if (charIndex === 0) {
      isDeleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      setTimeout(typeLoop, 260);
      return;
    }

    setTimeout(typeLoop, 45);
  };

  typeLoop();
}
