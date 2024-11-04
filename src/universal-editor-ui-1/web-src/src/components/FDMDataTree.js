import { attach } from "@adobe/uix-guest";
import { Provider, View, lightTheme, Text, Checkbox, ActionGroup,Item} from "@adobe/react-spectrum";
import {TreeView, TreeViewItem} from '@react-spectrum/tree'
import AddCircle from '@spectrum-icons/workflow/AddCircle';
import { extensionId } from "./Constants";
import {useState, useEffect, useRef } from 'react';
import actionWebInvoke from '../utils';
import allActions from '../config.json'
import {Content} from '@react-spectrum/view';
import {IllustratedMessage} from '@react-spectrum/illustratedmessage';
import NotFound from '@spectrum-icons/illustrations/NotFound';
import {Heading} from '@react-spectrum/text';
function DataTree () {

    const [loading, setLoading] = useState(true);
    const [guestConnection, setGuestConnection] = useState();
    const [fdmTree, setFDMTree] = useState({})
    const [items, setItems] = useState([])
    const [form, setForm] = useState({})
    const [instanceUrl, setInstanceUrl] = useState("")


    // interface iItems = {
    //     id: "", => datapath
    //     label: "", =>name
    //     icon: 
    //     children: []
    // }
    
    useEffect(() => {
        (async () => {
            const guestConnection = await attach({ id: extensionId });
            setGuestConnection(guestConnection);
        })();
    }, []);

    const isObject = (val) => typeof val === 'object' && val !== null;
    function renderEmptyState() {
        return (
          <IllustratedMessage>
            <NotFound />
            <Heading>No results</Heading>
            <Content>No results found</Content>
          </IllustratedMessage>
        );
      }
    function getTree(jsonNode, level) {
    
        return Object.keys(jsonNode).map((key) => {
            const value = jsonNode[key];
            
            return (
                key === "title" ? (
                <View marginTop="size-100"
                marginStart={level+10}>
                <Checkbox
                    selectionMode="single"
                    aria-label="Static ListView items example"
                    maxWidth="size-6000"
                    defaultSelected
                >
                    {value}
                </Checkbox> 
                </View>) : <></>
                && 
                isObject(value) ? (
                  getTree(value, level+10)
                ) : (<></>)
            );
          });
          
    }

    const getResourceType = (type) => {
        switch(type) {
            case "integer":
                return "core/fd/components/form/numberinput/v1/numberinput";
            case "boolean": 
                return "core/fd/components/form/checkbox/v1/checkbox";
            case "text":
            case "string":
                return "core/fd/components/form/textinput/v1/textinput";
            case "panel":
            case "object":
                return "core/fd/components/form/panelcontainer/v1/panelcontainer";
        }
    }

    const getFieldType = (type) => {
        switch(type) {
            case "integer":
                return "number-input";
            case "boolean": 
                return "checkbox";
            case "text":
            case "string":
                return "text-input";
            case "panel":
            case "object":
                return "panel";
        }
    }

    const baseObjContructor = (component) => {
        let isNested = !!component.children;
    
        return {
            "name": `${component.label}`,
            "xwalk": {
                "page": {
                    "resourceType": getResourceType(component.type),
                    "template": {
                        "jcr:title": `${component.label}`,
                        "fieldType": getFieldType(component.type),
                        "enabled": true,
                        "visible": true,
                        "dataRef": `${component.dataRef}`
                    }
                }
            }
        }
    }

    const UEComponentCreator = (component) => {
        const obj = {
            [`${component.label}`] : {
                "sling:resourceType": getResourceType(component.type),
                fieldType: getFieldType(component.type),
                "jcr:title": `${component.label}`,
                "enabled": true,
                "visible": true,
            }
        }
        if(component.children) {
            component.children.forEach((child) => {
                Object.assign(obj[component.label], UEComponentCreator(child))
            })
        }
        return obj;
    }

    const constructContent = (component) => {
        const baseObj = baseObjContructor(component);
        if(!component.children) {
            return baseObj;
        }
        component.children.forEach(element => {
            Object.assign(baseObj.xwalk.page.template, UEComponentCreator(element))
        });
        return baseObj;
    }
 
    const addComponent = async (component) => {
        const details = {
            "connections": [
                {
                    "name": "aemconnection",
                    "protocol": "xwalk",
                    "uri": `${instanceUrl}`
                }
            ],
            "target": {
                "container": {
                    "resource": `${form.resource}`,
                    "type": "container",
                    "prop": ""
                }
            },
            "content": constructContent(component)
        };
        const resData = null;

        try {
        const res = await fetch("https://universal-editor-service.experiencecloud.live/add", {
            "headers": {
              "accept": "*/*",
              "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
              "authorization": `Bearer ${guestConnection.sharedContext.get('token')}`,
              "cache-control": "no-cache",
              "content-type": "application/json",
              "pragma": "no-cache",
              "priority": "u=1, i",
              "sec-fetch-mode": "cors",
              "sec-fetch-site": "cross-site",
              "x-aemconnection-authorization": "",
              'Access-Control-Allow-Origin': 'https://author-p110203-e261689-cmstg.adobeaemcloud.com/'
            },
            "body": JSON.stringify(details),
            "method": "POST"
          });
          resData = await res.json();
          console.log(resData)
        } catch(e) {
            console.error(e)
        }


        // Trigger event
        const triggerResponse = await guestConnection.host.remoteApp.triggerEvent('aue:content-add',
            'main',
            {
                request: details,
                response: resData
            }
        );
        console.log(triggerResponse);
    }

    const mapToItems = (obj) => {
        const mapProperties = (properties) => {
          return Object.keys(properties).map((key) => {
            const property = properties[key];
            const item = {
              id: property.datapath,
              label: key,
              type: property.type || 'panel',
              children: property.properties ? mapProperties(property.properties) : undefined,
            };
            return item;
          });
        };
        const rootItem = {
            id: obj.datapath || '',
            label: obj.title || 'root',
            type: obj.type || 'panel',
            children: mapProperties(obj.properties),
        }
        return [rootItem]
      };


    useEffect(() => {
        if(!guestConnection) {
            return;
        }
        const fetchData = async () => {
            const editorState = await guestConnection.host.editorState.get();
            var { connections, selected, editables, location, customTokens } = editorState;
            try {

                // Set the HTTP headers to access the Adobe I/O runtime action
                const headers = {
                    'Authorization': 'Bearer ' + guestConnection.sharedContext.get('token'),
                    'x-gw-ims-org-id': guestConnection.sharedContext.get('orgId'),
                    'Access-Control-Allow-Origin': 'http://localhost:9080'
                };

                console.log(editables);
                const form = editables.filter(item => item.model === "form");
                setForm(form[0])
                console.log(form);

                const tempEndpointName = Object.keys(connections).filter((key) => 
                    connections[key].startsWith("xwalk:")
                )[0];
                setInstanceUrl(connections[tempEndpointName].replace("xwalk:", ""));

    
                if (customTokens && customTokens[tempEndpointName]) {
                    token = customTokens[tempEndpointName];
                } else {
                    token = "Bearer " + guestConnection.sharedContext.get('token');
                }

                const params = {
                    "endpoint": connections[tempEndpointName].replace("xwalk:", ""),
                    "token": token,
                    "formPath": form[0].resource.replace("urn:aemconnection:", ""),
                    "x-gw-ims-org-id": guestConnection.sharedContext.get('orgId')
                };
        
                const actionResponse = await actionWebInvoke(allActions['fetchFDMTree'], headers, params);
                console.log(actionResponse);
                if(actionResponse.error) {
                    setLoading(false);
                }
                setFDMTree(actionResponse);
                const items = mapToItems(actionResponse)
                setItems(items)
                console.log(items)
            } finally {
                setLoading(false);
            }
        };
        if (loading) {
            fetchData().catch((e) => console.log("Extension error:", e));
        }
    } , [guestConnection]);

    if (loading) {
        return (
            <Provider theme={lightTheme} colorScheme="light">
                <View padding="size-250">
                    <Text>Trying to load data tree...</Text>
                </View>
            </Provider>
        )
    }

    return (
        <Provider theme={lightTheme} colorScheme="light">
            <View>
                {/* {getTree(fdmTree, 10)} */}
                <TreeView
                    items={items}
                    renderEmptyState={renderEmptyState}>
                    {(item) => (
                        <TreeViewItem childItems={item.children} textValue={item.label}>
                        <Text>{item.label}</Text>
                        <ActionGroup
                            onAction={() => addComponent(item)}
                        >
                            <Item key="add" textValue="Add">
                                <AddCircle />
                            <Text>Add</Text>
                            </Item>
                        </ActionGroup>
                        </TreeViewItem>
                    )}
                </TreeView>
            </View>
        </Provider>
    );
};

export default DataTree;
