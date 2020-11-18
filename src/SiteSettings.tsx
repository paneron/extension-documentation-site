/** @jsx jsx */
/** @jsxFrag React.Fragment */

import log from 'electron-log';
import yaml from 'js-yaml';
import { css, jsx } from '@emotion/core';
import React, { useState, useEffect, useContext } from 'react';
import { ObjectChangeset, ObjectDataset } from "@riboseinc/paneron-extension-kit/types";
import { Button, ButtonGroup, ControlGroup, FormGroup, InputGroup, Menu, NonIdealState, Popover } from '@blueprintjs/core';
import { DocSiteSettingsHook } from './hooks';
import deploymentSetup from './deployment';
import { ExtensionViewContext } from '@riboseinc/paneron-extension-kit/context';


export interface SiteSettings {
  title: string
  docsURLPrefix: string
  siteURLPrefix: string
  footerBannerLink: string
  headerBannerBlob: string
  footerBannerBlob: string
  deploymentSetup: string | null
}


interface SiteSettingsFile {
  title: string
  docsURLPrefix: string
  siteURLPrefix: string
  footerBannerLink: string
  deploymentSetup: string | null
}


export const SETTINGS_FILENAME = 'site-settings.yaml';
export const HEADER_BANNER_FILENAME = 'header-banner.svg';
export const FOOTER_BANNER_FILENAME = 'footer-banner.svg';


function toFileContents(settings: SiteSettings): SiteSettingsFile {
  return {
    title: settings.title,
    docsURLPrefix: settings.docsURLPrefix,
    siteURLPrefix: settings.siteURLPrefix,
    footerBannerLink: settings.footerBannerLink,
    deploymentSetup: settings.deploymentSetup,
  };
}


export const SiteSettings: React.FC<{
  originalSettings: ReturnType<DocSiteSettingsHook>
}> = function ({ originalSettings }) {
  const { changeObjects } = useContext(ExtensionViewContext);

  const [editedSettings, updateEditedSettings] = useState<SiteSettings | null>(null);
  const settings: SiteSettings | null = editedSettings || originalSettings.value;

  const [_isBusy, setBusy] = useState(false);
  const isBusy: boolean = originalSettings.isUpdating || _isBusy;

  async function handleWriteDeploymentSetup(setupID: string, remove = false) {
    if (isBusy || settings === null || editedSettings !== null) { return; }

    let changeset: ObjectChangeset;
    try {
      changeset = deploymentSetup[setupID].getChangeset(settings, remove);
    } catch (e) {
      log.error("Unable to retrieve changeset for deployment setup with ID", setupID);
      return;
    }

    const settingsFileData: SiteSettingsFile = {
      ...toFileContents(settings),
      deploymentSetup: remove === false ? setupID : null,
    }

    setBusy(true);
    try {
      await changeObjects({
        ...changeset,
        [SETTINGS_FILENAME]: {
          encoding: 'utf-8' as const,
          oldValue: undefined,
          newValue: yaml.dump(settingsFileData, { noRefs: true }),
        },
      }, "Write deployment setup", true);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSettings(newSettings: SiteSettings) {
    if (isBusy) { return; }

    const settingsFileData = toFileContents(newSettings);

    setBusy(true);
    try {
      await changeObjects({
        [SETTINGS_FILENAME]: {
          encoding: 'utf-8' as const,
          oldValue: undefined,
          newValue: yaml.dump(settingsFileData, { noRefs: true }),
        },
        [HEADER_BANNER_FILENAME]: {
          encoding: 'utf-8' as const,
          oldValue: undefined,
          newValue: newSettings.headerBannerBlob,
        },
        [FOOTER_BANNER_FILENAME]: {
          encoding: 'utf-8' as const,
          oldValue: undefined,
          newValue: newSettings.footerBannerBlob,
        },
      }, "Update site settings", true);
    } finally {
      setBusy(false);
      updateEditedSettings(null);
    }
  }

  if (settings === null) {
    return <NonIdealState
      description={<Button onClick={() => handleSaveSettings(SETTINGS_STUB)}>Initialize site settings</Button>}
    />
  }

  return (
    <>
      <FormGroup>
        <InputGroup
          fill
          value={settings.title}
          disabled={isBusy}
          onChange={(evt: React.FormEvent<HTMLInputElement>) =>
            updateEditedSettings({ ...settings, title: evt.currentTarget.value })} />
      </FormGroup>

      <FormGroup label="Branding:">
        <SVGFileInputWithPreview
          text="Change header banner image"
          contentsBlob={settings.headerBannerBlob}
          onContentsChange={!isBusy ? (newBlob) => {
            updateEditedSettings({ ...settings, headerBannerBlob: newBlob })
          } : undefined}
        />
        <SVGFileInputWithPreview
          text="Change footer banner image"
          contentsBlob={settings.footerBannerBlob}
          onContentsChange={!isBusy ? (newBlob) => {
            updateEditedSettings({ ...settings, footerBannerBlob: newBlob })
          } : undefined}
        />
      </FormGroup>

      <FormGroup label="Footer banner link:" inline>
        <InputGroup
          value={settings.footerBannerLink}
          disabled={isBusy}
          onChange={(evt: React.FormEvent<HTMLInputElement>) =>
            updateEditedSettings({ ...settings, footerBannerLink: evt.currentTarget.value })} />
      </FormGroup>
      <FormGroup label="Prefixes:" labelInfo="(if in doubt, leave empty)">
        <ControlGroup>
          <InputGroup
            fill
            title="Global React site prefix under domain name, when deployed. Used e.g. in shared static hosting setups, like GitLab or GitHub Pages."
            placeholder="for the whole site"
            value={settings.siteURLPrefix}
            disabled={isBusy}
            onChange={(evt: React.FormEvent<HTMLInputElement>) =>
              updateEditedSettings({ ...settings, siteURLPrefix: evt.currentTarget.value })} />
          <InputGroup
            fill
            title="Path prefix for these docs within the React site."
            placeholder="for the docs"
            value={settings.docsURLPrefix}
            disabled={isBusy}
            onChange={(evt: React.FormEvent<HTMLInputElement>) =>
              updateEditedSettings({ ...settings, docsURLPrefix: evt.currentTarget.value })} />
        </ControlGroup>
      </FormGroup>
      <ButtonGroup fill css={css`& > * { white-space: nowrap; }`}>
        <Button
            disabled={isBusy || editedSettings === null}
            onClick={() => editedSettings !== null ? handleSaveSettings(editedSettings) : void 0}
            intent={editedSettings !== null ? 'success' : undefined}>
          Save site settings
        </Button>
        <Popover
            content={
              <Menu>
                <Menu.Divider title={settings.deploymentSetup ? "Clear deployment setup" : "Write deployment setup"} />
                {settings.deploymentSetup
                  ? <Menu.Item
                        icon="trash"
                        disabled={isBusy || editedSettings !== null}
                        onClick={() => settings.deploymentSetup ? handleWriteDeploymentSetup(settings.deploymentSetup, true) : void 0}
                        text={deploymentSetup[settings.deploymentSetup]?.title} />
                  : Object.entries(deploymentSetup).map(([setupID, setup]) =>
                      <Menu.Item
                        key={setupID}
                        icon="add"
                        disabled={isBusy || editedSettings !== null}
                        onClick={() => handleWriteDeploymentSetup(setupID)}
                        text={setup.title}
                        title={setup.description} />
                    )}
              </Menu>
            }>
          <Button disabled={isBusy || editedSettings !== null} icon="more" />
        </Popover>
      </ButtonGroup>
    </>
  );
};


const Buffer = require('electron').remote.getGlobal('Buffer');


const SVGFileInputWithPreview: React.FC<{
  text: string
  contentsBlob: string
  onContentsChange?: (blob: string) => void
}> = function ({ text, contentsBlob, onContentsChange }) {

  const { requestFileFromFilesystem } = useContext(ExtensionViewContext);

  const [previewDataURL, setPreviewDataURL] = useState<null | string>(null);

  useEffect(() => {
    log.silly("Converting SVG contents to base64", Buffer);
    let base64string: string;
    try {
      base64string = Buffer.from(contentsBlob, 'utf-8').toString('base64');
    } catch (e) {
      log.error("Failed to convert SVG contents to base64", e);
      return;
    }
    log.silly("Creating a data URI from base64");
    const dataURL = `data:image/svg+xml;base64,${base64string}`;
    log.silly("Got data URI", dataURL);
    setPreviewDataURL(dataURL);
  }, [contentsBlob]);

  async function handleChangeFile() {
    if (!onContentsChange) {
      return;
    }

    const result: ObjectDataset = await requestFileFromFilesystem({
      prompt: "Please choose a small SVG file",
      filters: [{ name: "Images", extensions: ['svg'] }],
    });
    if (Object.keys(result).length !== 1) {
      throw new Error("Failed to choose a single file");
    }
    const chosenFile = Object.values(result)[0];
    if (chosenFile?.encoding !== 'utf-8') {
      throw new Error("Failed to choose an SVG file")
    }
    onContentsChange(chosenFile.value);
  }

  return (
    <div css={css`display: flex; flex-flow: row nowrap; align-items: center; overflow: hidden;`}>
      {previewDataURL
        ? <img
            src={previewDataURL}
            css={css`width: 2rem; height: 2rem; margin-right: .5rem; flex-shrink: 0;`} />
        : null}
      <Button alignText="left" fill disabled={!onContentsChange} onClick={handleChangeFile}>
        {text}
      </Button>
    </div>
  );
};


const DEFAULT_FOOTER_BANNER_SVG = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generator: Adobe Illustrator 21.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
  viewBox="0 0 900 167.6" style="enable-background:new 0 0 900 167.6;" xml:space="preserve">
  <style type="text/css">
    .st0{fill:#464646;}
    .st1{display:none;fill:#464646;}
  </style>
  <path class="st0" d="M231.5,118.3h-18.2V47.6l18.2-2.6v11.6C236,49,241.7,44.9,250,44.9c4.3,0,8.8,0.9,12.7,3.2l-4,16.4
    c-3.4-1.9-6.8-2.8-10.2-2.8c-6.3,0-12.2,4-17,12.7L231.5,118.3L231.5,118.3z"/>
  <path class="st0" d="M282.8,34.1c-7.1,0-11.1-4.3-11.1-11c0-6.5,4-11,11.1-11c7.3,0,11.3,4.5,11.3,11
    C294.1,29.8,290.1,34.1,282.8,34.1z M273.7,118.3V47.6l18.2-2.6v73.3H273.7z"/>
  <path class="st0" d="M341.6,120.5c-4.6,0-11.3-0.9-15.9-2.5l-17.4,2.6V15.1l18.2-2.5c0,0,0,40.5,0,41.2c4.8-4.6,11.3-9.1,19.9-9.1
    c18.8,0,31.2,15.3,31.2,37.2C377.6,104.7,361.9,120.5,341.6,120.5z M341.2,60.1c-6,0-10.7,2.3-14.7,5.9c0-0.5,0,36,0,36
    c3.4,2.6,8,4,13.4,4c12.2,0,19.1-9.9,19.1-23.2C359.1,68.9,352.4,60.1,341.2,60.1z"/>
  <path class="st0" d="M424.2,120.6c-20.8,0-36-14.2-36-37.8c0-23.5,15.9-38.1,36.9-38.1s36,14.5,36,38
    C461.1,105.9,445.1,120.6,424.2,120.6z M424.5,59.3c-11.9,0-18.4,9.6-18.4,23.3c0,13.6,6.8,23.2,18.7,23.2c11.7,0,18.2-9.3,18.2-23
    S436.3,59.3,424.5,59.3z"/>
  <path class="st0" d="M498.5,120.8c-9.3,0-20.5-2.6-27.6-6.6l4-14.2c7.1,4,16.2,6.6,24.1,6.6c7.1,0,11.7-2.9,11.7-7.9
    c0-5.6-6-7.6-14.4-9.6c-13.4-3.1-24.1-8.6-24.1-22.1s11.3-22.2,28.4-22.2c8.8,0,19.3,2.3,25.9,5.7l-4,14.2
    c-6.9-3.6-16.1-5.9-22.4-5.9c-6.6,0-10.7,2.5-10.7,7.1c0,5.4,6,7.3,14.4,9.3c13.6,3.2,24.2,8.5,24.2,22.4
    C528.2,110.9,516.7,120.8,498.5,120.8z"/>
  <path class="st0" d="M556.7,86.6c0.8,11.6,8.6,19.5,21.3,19.5c7.6,0,15.8-2.5,22.2-6.5l2.3,15.1c-6.8,3.7-16.2,5.9-25.8,5.9
    c-22.9,0-38-14.5-38-37.2c0-23.2,15.4-38.6,36.8-38.6c18.8,0,29.3,11.4,29.3,28.9c0,3.9-0.6,8.8-1.5,11.9c-0.2,0-46.6,0.6-46.6,0.6
    V86.6z M587.8,75.4c0-0.3,0-1.1,0-1.2c0-9.6-4.2-15.6-13.6-15.6c-10,0-16.1,8.2-17,17L587.8,75.4z"/>
  <path class="st0" d="M650.9,120.3c-19.6,0-34.1-14.5-34.1-37.2c0-22.5,15.1-37.5,34.9-37.5s34,14.5,34,37.2
    C685.6,105.3,670.5,120.3,650.9,120.3z M651.2,54.2c-15,0-24.9,11.9-24.9,28.6c0,17.3,10,28.9,25,28.9s24.9-11.9,24.9-28.6
    C676.2,65.8,666.2,54.2,651.2,54.2z"/>
  <path class="st0" d="M729.1,46c19.1,0,31.7,15.1,31.7,36.6c0,21.9-14.5,37.7-34.9,37.7c-5.6,0-12.7-1.5-17.3-3.7v37.7H699v-107
    l9.6-2c0,0,0,9,0,9.4C713.3,50.2,720.4,46,729.1,46z M708.6,106.1c4.3,3.4,11,5.6,17.8,5.6c15.1,0,24.6-12.2,24.6-28.9
    c0-16.4-9-27.9-23.3-27.9c-7.3,0-13.9,3.2-19,7.9C708.6,62.2,708.6,106.1,708.6,106.1z"/>
  <path class="st0" d="M780.9,84c0.3,15.9,9.9,27.3,24.7,27.3c7.7,0,15.1-2.3,20.5-5.9l1.9,8.8c-6,3.7-13.9,6-22.7,6
    c-20.4,0-34.1-15.3-34.1-36.8c0-22.2,14.2-38,33.4-38c15.6,0,25.8,10.2,25.8,26.1c0,3.7-0.6,8.2-1.5,11.3L781,83.1V84H780.9z
    M820.8,75.5c0.2-0.8,0.2-2.3,0.2-3.1c0-10.8-5.9-18.2-17-18.2c-12.7,0-20.8,9.7-22.4,21.5L820.8,75.5z"/>
  <path class="st0" d="M890.4,118.3V72.6c0-12.4-4.9-17.9-15.6-17.9c-7.7,0-15.6,4.2-21.5,10v53.6h-9.6V47.6l9.6-2v11.6
    c7.4-7.4,16.7-11.6,24.1-11.6c14.2,0,22.5,8.8,22.5,24.2v48.5H890.4z"/>
  <g>
    <polygon class="st0" points="144.9,29.5 114.6,29.5 99.5,55.6 114.6,81.8 144.9,81.8 160,55.6 	"/>
    <polygon class="st0" points="45.4,29.5 15.1,29.5 0,55.6 15.1,81.8 45.4,81.8 60.5,55.6 	"/>
    <polygon class="st0" points="95.1,115.2 64.9,115.2 49.8,141.4 64.9,167.6 95.1,167.6 110.2,141.4 	"/>
    <polygon class="st0" points="95.1,0 64.9,0 49.8,26.2 64.9,52.4 95.1,52.4 110.2,26.2 	"/>
    <polygon class="st0" points="144.9,86.4 114.6,86.4 99.5,112.6 114.6,138.8 144.9,138.8 160,112.6 	"/>
    <polygon class="st0" points="45.4,86.4 15.1,86.4 0,112.6 15.1,138.8 45.4,138.8 60.5,112.6 	"/>
    <polygon class="st1" points="95.1,57.6 64.9,57.6 49.8,83.8 64.9,110 95.1,110 110.2,83.8 	"/>
  </g>
</svg>
`;


const DEFAULT_HEADER_BANNER_SVG = `<svg width="30" height="29" viewBox="0 0 30 29" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M25.2071 3.29365L29.7822 11.0446L27.8779 14.2869L29.8507 17.6279L25.2838 25.3591H21.4228L19.4742 28.6567H10.3402L8.39162 25.3591H4.63153L0.0484161 17.6398L1.97284 14.3856L0 11.0446L4.56294 3.29759H8.37547L10.3241 0H19.4581L21.3946 3.29365H25.2071ZM18.7883 20.9058H22.6493L24.606 17.6398L22.6574 14.3422H22.6049L24.5535 11.0446L22.6049 7.74697H18.7924L16.8438 4.44938H12.9465L10.9979 7.74697H7.18532L5.23669 11.0446L7.18129 14.3106H7.23373L5.28511 17.6082L7.23373 20.9058H10.9938L12.9425 24.2034H16.8397L18.7883 20.9058Z" fill="white"/>
</svg>
`;


const SETTINGS_STUB: SiteSettings = {
  title: "Documentation site",
  footerBannerLink: 'https://open.ribose.com/',
  docsURLPrefix: '',
  siteURLPrefix: '',
  headerBannerBlob: DEFAULT_HEADER_BANNER_SVG,
  footerBannerBlob: DEFAULT_FOOTER_BANNER_SVG,
  deploymentSetup: null,
};
