import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { getShareCardSessionLabel, SHARE_CARD_SUBTITLE } from '../data/shareCardContent.js';

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1350;

// Visual slot ("main", "top-left", "bottom-right") for each photo, in the same
// order as the scene order for the day. The main slot is the large hero photo.
const PHOTO_SLOTS = ['top-left', 'main', 'bottom-right'];

// Renders the intrinsic 1080x1350 Share Card inside a wrapper that scales it
// down responsively, so the exported PNG (captured from the inner node) is
// never a scaled DOM node itself.
const ShareCardPreview = forwardRef(function ShareCardPreview({ slogan, mascot, photos, coverPhoto = null }, cardRef) {
  const wrapperRef = useRef(null);
  const [scale, setScale] = useState(0);
  // A past day renders one photo in the existing hero slot; the live day keeps
  // the three-circle collage. Neither is ever partially populated.
  const hasCoverPhoto = Boolean(coverPhoto?.image);
  const hasFullCollage = !hasCoverPhoto && photos.length === 3;
  const isPhotoless = !hasCoverPhoto && !hasFullCollage;

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;
    const applyWidth = (width) => {
      if (width) setScale(width / SHARE_CARD_WIDTH);
    };
    applyWidth(wrapper.getBoundingClientRect().width);

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => applyWidth(entries[0]?.contentRect?.width));
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="share-card-scaler"
      ref={wrapperRef}
      style={{ height: SHARE_CARD_HEIGHT * scale }}
    >
      <div
        className="share-card-scale-inner"
        style={{ width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, transform: `scale(${scale})` }}
      >
        <div className="share-card" ref={cardRef} style={{ width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT }}>
          <div className="share-card-slogan">
            <strong>
              {slogan.map((line, index) => <span key={index}>{line}</span>)}
            </strong>
            <span className="share-card-subtitle">{SHARE_CARD_SUBTITLE}</span>
          </div>

          <div className={`share-card-photos${isPhotoless ? ' is-photoless' : ''}`}>
            {hasFullCollage && photos.map((photo, index) => (
              <figure
                className={`share-card-photo share-card-photo-${PHOTO_SLOTS[index] || 'main'}`}
                key={photo.sceneId || index}
              >
                <img src={photo.image} alt="" />
                <figcaption>
                  <b>{index + 1}</b>
                  {getShareCardSessionLabel(index)}
                </figcaption>
              </figure>
            ))}
            {hasCoverPhoto && (
              <figure className="share-card-photo share-card-photo-main">
                <img src={coverPhoto.image} alt="" />
                <figcaption>
                  <b>{(coverPhoto.sessionIndex || 0) + 1}</b>
                  {getShareCardSessionLabel(coverPhoto.sessionIndex || 0)}
                </figcaption>
              </figure>
            )}
            <img className="share-card-mascot" src={mascot} alt="" />
          </div>

          <div className="share-card-footer">
            <p className="share-card-branding">FaceRest</p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ShareCardPreview;
