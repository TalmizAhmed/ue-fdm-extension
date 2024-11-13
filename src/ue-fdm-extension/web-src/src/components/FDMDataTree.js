import { attach } from "@adobe/uix-guest";
import { Provider, View, lightTheme, Text, Checkbox, ActionGroup, Item } from "@adobe/react-spectrum";
import { TreeView, TreeViewItem } from '@react-spectrum/tree'
import AddCircle from '@spectrum-icons/workflow/AddCircle';
import { extensionId } from "./Constants";
import { useState, useEffect, useRef } from 'react';
import { Content } from '@react-spectrum/view';
import { IllustratedMessage } from '@react-spectrum/illustratedmessage';
import NotFound from '@spectrum-icons/illustrations/NotFound';
import { Heading } from '@react-spectrum/text';
import { ue } from './Transformer';

function DataTree() {

    const [loading, setLoading] = useState(true);
    const [guestConnection, setGuestConnection] = useState();
    const [items, setItems] = useState([])
    const [mapper, setMapper] = useState({})


    useEffect(() => {
        (async () => {
            const guestConnection = await attach({ id: extensionId });
            setGuestConnection(guestConnection);
        })();
    }, []);

    function renderEmptyState() {
        return (
            <IllustratedMessage>
                <NotFound />
                <Heading>No results</Heading>
                <Content>No results found</Content>
            </IllustratedMessage>
        );
    }

    const addComponent = async (component) => {
        // console.log(`Component: ${JSON.stringify(component)} is now mapped to ${JSON.stringify(mapper[component.id])}`)
        const updateUERendition = async (request, response) => {
            await guestConnection.host.remoteApp.triggerEvent('aue:content-add',
                'main',
                {
                    request,
                    response
                }
            );
        }

        await ue.update({
            data: mapper[component.id],
            instanceUrl,
            formResource: form.resource,
            token: guestConnection.sharedContext.get('token'),
            callback: updateUERendition
        })
    }

    useEffect(() => {
        if (!guestConnection) {
            return;
        }
        const fetchData = async () => {
            const editorState = await guestConnection.host.editorState.get();
            var { connections, editables, customTokens } = editorState;
            try {
                const tempEndpointName = Object.keys(connections).filter((key) =>
                    connections[key].startsWith("xwalk:")
                )[0];
                const instanceUrl = connections[tempEndpointName].replace("xwalk:", "")
                const form = editables.filter(item => item.model === "form");
                const formPath = form[0].resource.replace("urn:aemconnection:", "")
                let token;
                if (customTokens && customTokens[tempEndpointName]) {
                    token = customTokens[tempEndpointName];
                } else {
                    token = "Bearer " + guestConnection.sharedContext.get('token');
                }
                const orgId = guestConnection.sharedContext.get('orgId')

                const schemaResponse = ue.fetchSchema({ formPath, instanceUrl, token, orgId })

                if (schemaResponse.error) {
                    setLoading(false);
                    console.error("Failed to fetch schema: ", schemaResponse.error)
                }
                const { map, viewData: newItems } = ue.mapToView(actionResponse);
                setMapper(map)
                console.log("New items: ", newItems)
                setItems([newItems])
            } catch (e) {
                console.error("Failed fetch: ", e)
            }
            finally {
                setLoading(false);
            }
        };
        if (loading) {
            fetchData().catch((e) => console.log("Extension error:", e));
        }
    }, [guestConnection]);

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
                <TreeView
                    items={items}
                    renderEmptyState={renderEmptyState}>
                    {(item) => (
                        <TreeViewItem childItems={item.children} textValue={item.name}>
                            <Text>{item.name}</Text>
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
